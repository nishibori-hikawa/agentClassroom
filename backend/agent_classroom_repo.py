from pprint import pprint
from typing import Any

from dotenv import load_dotenv
from langchain_core.language_models import BaseChatModel
from langchain_core.retrievers import BaseRetriever
from langchain_google_vertexai import VertexAI
from langgraph.graph import StateGraph
from pydantic import BaseModel, Field

from agent import CriticAgent, ReporterAgent
from retrievers import create_pdf_retriever


class State(BaseModel):
    query: str = Field(..., description="ユーザーからの質問")
    current_role: str = Field(default="", description="選定された回答ロール")
    reporter_content: str = Field(default="", description="reporterの回答内容")
    critic_content: str = Field(default="", description="criticの回答内容")


class AgentClassroom:
    def __init__(self, llm: BaseChatModel, retriever: BaseRetriever) -> None:
        self.graph = self._create_graph()
        self.retriever = retriever
        self.llm = llm
        self.reporter = ReporterAgent(retriever, llm)
        self.critic = CriticAgent(llm, retriever)

    def _create_graph(self) -> StateGraph:
        workflow = StateGraph(State)

        workflow.add_node("reporter", self.reporter_node)
        workflow.add_node("critic", self.critic_node)
        workflow.add_edge("reporter", "critic")
        workflow.set_entry_point("reporter")

        return workflow

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


def main():
    load_dotenv()
    # llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    llm = VertexAI(model="gemini-1.5-flash-001", temperature=0)
    retriever = create_pdf_retriever("./documents/main.pdf")
    agent = AgentClassroom(llm, retriever)
    compiled = agent.graph.compile()
    init_state = State(query="")
    result = compiled.invoke(init_state)
    pprint(result)


if __name__ == "__main__":
    main()
