import os
from enum import Enum
from pprint import pprint
from typing import Any

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


class ProsCons(Enum):
    PROS = "pros"
    CONS = "cons"


class HumanSelection(BaseModel):
    selection_num: int = Field(..., description="選択された回答番号")
    pros_cons: ProsCons = Field(..., description="選択された回答の利点か欠点か")


class State(BaseModel):
    query: str = Field(..., description="ユーザーからの質問")
    current_role: str = Field(default="", description="選定された回答ロール")
    reporter_content: str = Field(default="", description="reporterの回答内容")
    critic_content: CriticContent = Field(default=None, description="criticの回答内容")
    human_selection: HumanSelection = Field(
        default=HumanSelection(selection_num=0, pros_cons=ProsCons.CONS),
        description="humanの選択内容",
    )
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

    def reporter_node(self, state: State) -> dict[str, Any]:
        query = state.query

        reporter = self.reporter
        generated_text = reporter.generate_report(query)

        return {
            "query": query,
            "current_role": "reporter",
            "reporter_content": generated_text,
        }

    def critic_node(self, state: State) -> dict[str, Any]:
        query = state.query
        report_text = state.reporter_content

        critic = self.critic
        generated_text = critic.generate_critique(report_text)

        return {"query": query, "current_role": "critic", "critic_content": generated_text}

    def human_node(self, state: State) -> dict[str, Any]:
        query = state.query
        human_selection = HumanSelection(selection_num=0, pros_cons=ProsCons.CONS)

        return {"query": query, "current_role": "human", "human_selection": human_selection}

    def check_node(self, state: State) -> dict[str, Any]:
        query = state.query

        return {"query": query, "current_role": "check"}

    def show_image(self):
        img_data = Image(self.graph.get_graph().draw_mermaid_png())
        file_path = "compiled_graph.png"
        with open(file_path, "wb") as f:
            f.write(img_data.data)

        # VS Codeで画像ファイルを開く
        os.system(f"code {file_path}")


def main():
    load_dotenv()
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    # llm = VertexAI(model="gemini-1.5-flash-001", temperature=0)
    # retriever = create_pdf_retriever("./documents/main.pdf")
    retriever = create_tavily_search_api_retriever()
    agent = AgentClassroom(llm, retriever)
    init_state = State(query="トランプの経済政策", thread_id=1)
    config = {"configurable": {"thread_id": "1"}}
    result = agent.graph.invoke(init_state, config)

    pprint(result)


if __name__ == "__main__":
    main()
