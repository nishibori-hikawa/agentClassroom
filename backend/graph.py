import asyncio
import os
from enum import Enum
from pprint import pprint
from typing import Any, AsyncGenerator, Literal

from dotenv import load_dotenv
from IPython.display import Image, display
from langchain_core.language_models import BaseChatModel
from langchain_core.retrievers import BaseRetriever
from langchain_google_vertexai import VertexAI
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph.state import END, CompiledGraph, StateGraph
from pydantic import BaseModel, Field

from agent import CriticAgent, CriticContent, ReporterAgent, TeachingAssistantAgent
from retrievers import create_tavily_search_api_retriever


class HumanSelection(BaseModel):
    point_num: int = Field(0, description="選択された回答番号")
    case_num: int = Field(0, description="選択されたケース番号")


class State(BaseModel):
    query: str = Field(..., description="ユーザーからの質問")
    current_role: str = Field(default="", description="選定された回答ロール")
    reporter_content: str = Field(default="", description="reporterの回答内容")
    critic_content: CriticContent = Field(
        default_factory=CriticContent,
        description="criticの回答内容",
    )
    critic_content_feedback: str = Field(default="", description="criticの回答内容のフィードバック")
    human_selection: HumanSelection = Field(
        default=HumanSelection(point_num=0, case_num=0),
        description="humanの選択内容",
    )
    check_content: str = Field(default="", description="checkの回答内容")
    thead_id: str = Field(default="", description="スレッドID")


class AgentClassroom:
    def __init__(self, llm: BaseChatModel, retriever: BaseRetriever) -> None:
        self.llm = llm
        self.retriever = retriever
        self.reporter = ReporterAgent(retriever, llm)
        self.critic = CriticAgent(llm)
        self.ta = TeachingAssistantAgent(llm)
        self.memory = MemorySaver()
        self.graph = self._create_graph()

    def _create_graph(self) -> CompiledGraph:
        workflow = StateGraph(State)

        workflow.add_node("reporter", self.reporter_node)
        workflow.add_node("critic", self.critic_node)
        workflow.add_node("feedback_critic", self.feedback_critic_node)
        workflow.add_node("human", self.human_node)
        workflow.add_node("check", self.check_node)

        workflow.add_edge("reporter", "critic")

        def should_continue(state: State) -> Literal["feedback_critic", "human"]:
            if state.critic_content_feedback != "":
                return "human"
            return "feedback_critic"

        workflow.add_conditional_edges("critic", should_continue)
        workflow.add_edge("feedback_critic", "critic")
        workflow.add_edge("human", "check")
        workflow.add_edge("check", END)

        workflow.set_entry_point("reporter")

        return workflow.compile(checkpointer=self.memory, interrupt_before=["human"])

    async def reporter_node(self, state: State) -> AsyncGenerator[dict[str, Any], None]:
        query = state.query
        accumulated_content = ""

        reporter = self.reporter
        async for token in reporter.generate_report_stream(query):
            accumulated_content += token
            state.reporter_content = accumulated_content
            yield {
                "query": query,
                "current_role": "reporter",
                "reporter_content": accumulated_content,  # Send only the new token
                "stream": True,
            }

        state.reporter_content = accumulated_content
        # Yield final state after streaming is complete
        yield {
            "query": query,
            "current_role": "reporter",
            "reporter_content": accumulated_content,
            "stream": False,  # Indicate this is the final state
        }

    def critic_node(self, state: State) -> dict[str, Any]:
        query = state.query
        report_text = state.reporter_content
        critic_content = state.critic_content
        critic_content_feedback = state.critic_content_feedback

        critic = self.critic
        generated_text = critic.generate_critique(
            report_text, critic_content, critic_content_feedback
        )

        return {
            "query": query,
            "current_role": "critic",
            "reporter_content": report_text,
            "critic_content": generated_text,
            "critic_content_feedback": critic_content_feedback,
        }

    def feedback_critic_node(self, state: State) -> dict[str, Any]:
        query = state.query
        report_text = state.reporter_content

        ta = self.ta
        critic_content_feedback = ta.feedback_critic_content(state.critic_content)

        return {
            "query": query,
            "current_role": "critic",
            "reporter_content": report_text,
            "critic_content": state.critic_content,
            "critic_content_feedback": critic_content_feedback,
        }

    def human_node(self, state: State) -> dict[str, Any]:
        query = state.query
        human_selection = state.human_selection

        return {
            "query": query,
            "current_role": "human",
            "reporter_content": state.reporter_content,
            "critic_content": state.critic_content,
            "human_selection": human_selection,
            "check_content": state.check_content,
            "thead_id": state.thead_id,
        }

    def check_node(self, state: State) -> dict[str, Any]:
        query = state.query

        critic_case = state.critic_content.points[state.human_selection.point_num].cases[
            state.human_selection.case_num
        ]
        repoter = self.reporter
        generated_text = repoter.check_cases(critic_case)

        return {
            "query": query,
            "current_role": "check",
            "reporter_content": state.reporter_content,
            "critic_content": state.critic_content,
            "human_selection": state.human_selection,
            "check_content": generated_text,
            "thead_id": state.thead_id,
        }

    def show_image(self):
        img_data = Image(self.graph.get_graph().draw_mermaid_png())
        file_path = "compiled_graph.png"
        with open(file_path, "wb") as f:
            f.write(img_data.data)

        # VS Codeで画像ファイルを開く
        os.system(f"code {file_path}")


async def main():
    load_dotenv()
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    retriever = create_tavily_search_api_retriever()
    agent = AgentClassroom(llm, retriever)

    # agent.show_image()
    init_state = State(query="トランプの経済政策")
    config = {"configurable": {"thread_id": "1"}}

    async for event in agent.graph.astream_events(init_state, config, version="v1"):
        chunk = event.get("data", {}).get("chunk", {})
        try:
            state = State(**chunk)
            print("critic_content")
            pprint(state.critic_content)
            print("critic_content_feedback")
            pprint(state.critic_content_feedback)
        except Exception as e:
            continue


if __name__ == "__main__":
    asyncio.run(main())
