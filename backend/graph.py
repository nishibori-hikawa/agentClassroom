import os
from enum import Enum
from pprint import pprint
from typing import Any
import asyncio

from dotenv import load_dotenv
from IPython.display import Image, display
from langchain_core.language_models import BaseChatModel
from langchain_core.retrievers import BaseRetriever
from langchain_google_vertexai import VertexAI
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph.state import CompiledGraph, StateGraph
from pydantic import BaseModel, Field

from agent import CriticAgent, CriticContent, ReporterAgent
from retrievers import create_tavily_search_api_retriever


class HumanSelection(BaseModel):
    point_num: int = Field(0, description="選択された回答番号")
    case_num: int = Field(0, description="選択されたケース番号")


class State(BaseModel):
    query: str = Field(..., description="ユーザーからの質問")
    current_role: str = Field(default="", description="選定された回答ロール")
    reporter_content: str = Field(default="", description="reporterの回答内容")
    critic_content: CriticContent = Field(
        default_factory=CriticContent, description="criticの回答内容"
    )
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
        self.memory = MemorySaver()
        self.graph = self._create_graph()

    def _create_graph(self) -> CompiledGraph:
        workflow = StateGraph(State)

        workflow.add_node("reporter", self.reporter_node)
        workflow.add_node("critic", self.critic_node)
        workflow.add_node("human", self.human_node)
        workflow.add_node("check", self.check_node)
        workflow.add_edge("reporter", "critic")
        workflow.add_edge("critic", "human")
        workflow.add_edge("human", "check")
        workflow.set_entry_point("reporter")

        return workflow.compile(checkpointer=self.memory, interrupt_before=["human"])

    async def reporter_node(self, state: State) -> dict[str, Any]:
        print("reporter_node")
        query = state.query
        accumulated_content = ""

        reporter = self.reporter
        async for token in reporter.generate_report_stream(query):
            accumulated_content += token
            yield {
                "query": query,
                "current_role": "reporter",
                "reporter_content": accumulated_content,  # Send only the new token
                "stream": True,
            }

        # Yield final state after streaming is complete
        yield {
            "query": query,
            "current_role": "reporter",
            "reporter_content": accumulated_content,
            "stream": False,  # Indicate this is the final state
        }

    def critic_node(self, state: State) -> dict[str, Any]:
        print("critic_node")
        query = state.query
        report_text = state.reporter_content

        critic = self.critic
        generated_text = critic.generate_critique(report_text)

        return {"query": query, "current_role": "critic", "critic_content": generated_text}

    def human_node(self, state: State) -> dict[str, Any]:
        print("human_node")
        query = state.query
        human_selection = state.human_selection

        return {"query": query, "current_role": "human", "human_selection": human_selection}

    def check_node(self, state: State) -> dict[str, Any]:
        print("check_node")
        query = state.query
        print(state.human_selection)
        print(state.critic_content)
        critic_case = state.critic_content.points[state.human_selection.point_num].cases[
            state.human_selection.case_num
        ]
        repoter = self.reporter
        generated_text = repoter.check_cases(critic_case)

        return {"query": query, "current_role": "check", "check_content": generated_text}

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
    init_state = State(query="トランプの経済政策")
    config = {"configurable": {"thread_id": "1"}}

    async for event in agent.graph.astream(init_state, config):
        if "reporter" in event:
            if event["reporter"].get("stream"):
                # Print just the new token
                print(event["reporter"]["reporter_content"], end="", flush=True)
            else:
                # This is the final state
                print()  # Add a newline
                print("Reporter finished.")
        else:
            print()  # Add a newline before other outputs
            pprint(event)


if __name__ == "__main__":
    asyncio.run(main())
