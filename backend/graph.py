import asyncio
import os
from datetime import datetime
from enum import Enum
from pprint import pprint
from typing import Any, AsyncGenerator, Optional

from dotenv import load_dotenv
from IPython.display import Image, display
from langchain_core.language_models import BaseChatModel
from langchain_core.retrievers import BaseRetriever
from langchain_google_vertexai import VertexAI
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph.state import CompiledGraph, StateGraph
from pydantic import BaseModel, Field

from agent import CriticAgent, CriticContent, ReporterAgent, PointSelection
from retrievers import create_tavily_search_api_retriever


class State(BaseModel):
    query: str = Field(..., description="ユーザーからの質問")
    current_role: str = Field(default="", description="現在のロール")
    reporter_content: str = Field(default="", description="reporterの初回回答内容")
    report_id: str = Field(default="", description="レポートID")
    point_selection_for_critic: PointSelection = Field(
        default=None, description="ユーザーの要点選択"
    )
    explored_content: Optional[str] = Field(
        default=None, description="選択された要点の詳細レポート"
    )
    user_selection_of_critic: PointSelection = Field(
        default=None, description="ユーザーのcritic論点選択"
    )
    critic_content: CriticContent = Field(
        default_factory=CriticContent, description="criticの回答内容"
    )
    thread_id: str = Field(default="", description="スレッドID")
    is_yes_case: bool = Field(default=False, description="Yesの事例を調査するかどうか")


class AgentClassroom:
    def __init__(self, llm: BaseChatModel, retriever: BaseRetriever) -> None:
        self.llm = llm
        self.retriever = retriever
        self.reporter = ReporterAgent(llm)
        self.critic = CriticAgent(llm)
        self.memory = MemorySaver()
        self.graph = self._create_graph()

    def _create_graph(self) -> CompiledGraph:
        workflow = StateGraph(State)

        # ノードの追加
        workflow.add_node("reporter", self.reporter_node)
        workflow.add_node("select_point", self.point_selection_node)
        workflow.add_node("explore_report", self.explore_report_node)
        workflow.add_node("select_topic", self.topic_selection_node)
        workflow.add_node("critic", self.critic_node)

        # エッジの追加
        workflow.add_edge("reporter", "select_point")
        workflow.add_edge("select_point", "explore_report")
        workflow.add_edge("explore_report", "select_topic")
        workflow.add_edge("select_topic", "critic")

        workflow.set_entry_point("reporter")

        return workflow.compile()

    def invoke_node(self, node_name: str, state: State) -> State:
        """特定のノードのみを実行する"""
        workflow = StateGraph(State)
        workflow.add_node(node_name, getattr(self, f"{node_name}_node"))
        workflow.set_entry_point(node_name)
        graph = workflow.compile()

        config = {"configurable": {"thread_id": "1"}}
        result = graph.invoke(state, config)
        return State(**result)

    def reporter_node(self, state: State) -> dict[str, Any]:
        """初回の要点を3つ生成するノード"""
        query = state.query
        content = self.reporter.generate_report(query)
        # レポートを解析して保存
        report_content = self.reporter.parse_report_output(content, query)
        print(f"\nDebug - Reporter node:")
        print(f"Generated report ID: {report_content.id}")
        print(f"Number of reports in memory: {len(self.reporter.reports)}")

        return {
            "query": query,
            "current_role": "reporter",
            "reporter_content": content,
            "report_id": report_content.id,
            "thread_id": state.thread_id,
        }

    def point_selection_node(self, state: State) -> dict[str, Any]:
        """ユーザーによる要点選択を待機するノード"""
        return {
            "query": state.query,
            "current_role": "select_point",
            "reporter_content": state.reporter_content,
            "point_selection_for_critic": state.point_selection_for_critic,
            "report_id": state.report_id,
        }

    def explore_report_node(self, state: State) -> dict[str, Any]:
        """選択された要点について詳細レポートを生成するノード"""
        print(f"\nDebug - Generating detailed report for:")
        print(f"Report ID: {state.point_selection_for_critic.report_id}")
        print(f"Point ID: {state.point_selection_for_critic.point_id}")
        print(f"Available reports: {list(self.reporter.reports.keys())}")

        content = self.reporter.generate_detailed_report(
            state.point_selection_for_critic.report_id, state.point_selection_for_critic.point_id
        )
        print(f"\nDebug - Generated content length: {len(content)}")

        return {
            "query": state.query,
            "current_role": "explore_report",
            "reporter_content": state.reporter_content,
            "point_selection_for_critic": state.point_selection_for_critic,
            "explored_content": content,
            "report_id": state.report_id,
            "thread_id": state.thread_id,
        }

    def topic_selection_node(self, state: State) -> dict[str, Any]:
        """ユーザーによる最終トピック選択を待機するノード"""
        return {
            "query": state.query,
            "current_role": "select_topic",
            "reporter_content": state.reporter_content,
            "point_selection_for_critic": state.point_selection_for_critic,
            "explored_content": state.explored_content,
            "user_selection_of_critic": state.user_selection_of_critic,
            "report_id": state.report_id,
        }

    def critic_node(self, state: State) -> dict[str, Any]:
        """選択されたトピックに対して論点を生成するノード"""
        if (
            not state.point_selection_for_critic
            or not state.point_selection_for_critic.title
            or not state.point_selection_for_critic.content
        ):
            raise ValueError("Point selection with title and content is required for critic node")

        critic_content = self.critic.generate_critique(
            title=state.point_selection_for_critic.title,
            content=state.point_selection_for_critic.content,
        )

        return {
            "query": state.query,
            "current_role": "critic",
            "reporter_content": state.reporter_content,
            "point_selection_for_critic": state.point_selection_for_critic,
            "explored_content": state.explored_content,
            "user_selection_of_critic": state.user_selection_of_critic,
            "critic_content": critic_content,
            "report_id": state.report_id,
        }

    def investigate_cases_node(self, state: State) -> dict[str, Any]:
        """選択された論点に対してYes/Noの事例を調査するノード"""
        print("\nDebug - Investigate Cases Node:")
        print(f"Current state: {state.dict()}")
        print(f"Point selection: {state.point_selection_for_critic}")
        print(f"User selection: {state.user_selection_of_critic}")
        print(f"Is Yes Case: {state.is_yes_case}")

        # 必須フィールドのチェックを修正
        if not state.point_selection_for_critic:
            print("Debug - Error: Missing point_selection_for_critic")
            raise ValueError("Point selection is required for case investigation")

        # titleとcontentがpoint_selection_for_criticにない場合は、
        # user_selection_of_criticから取得を試みる
        title = state.point_selection_for_critic.title
        content = state.point_selection_for_critic.content

        print(f"Debug - Initial title from point_selection: {title}")
        print(f"Debug - Initial content from point_selection: {content}")

        if not title or not content:
            print("Debug - Title or content missing from point_selection_for_critic")
            if state.user_selection_of_critic:
                print("Debug - Attempting to get from user_selection_of_critic")
                title = state.user_selection_of_critic.title
                content = state.user_selection_of_critic.content
                print(f"Debug - Title from user_selection: {title}")
                print(f"Debug - Content from user_selection: {content}")
            else:
                print(
                    "Debug - Error: Could not find title and content in either point_selection_for_critic or user_selection_of_critic"
                )
                raise ValueError("Title and content are required for case investigation")

        yes_or_no = "Yes" if state.is_yes_case else "No"
        print(f"Debug - Investigating {yes_or_no} case for title: {title}")

        cases_content = self.reporter.check_cases(
            title=title,
            content=content,
            yes_or_no=yes_or_no,
        )

        result = {
            "query": state.query,
            "current_role": "investigate_cases",
            "reporter_content": state.reporter_content,
            "point_selection_for_critic": state.point_selection_for_critic,
            "explored_content": cases_content,
            "report_id": state.report_id,
            "thread_id": state.thread_id,
            "critic_content": state.critic_content,
        }
        print("Debug - Returning result:", result)
        return result

    def show_image(self):
        img_data = Image(self.graph.get_graph().draw_mermaid_png())
        file_path = "compiled_graph.png"
        with open(file_path, "wb") as f:
            f.write(img_data.data)
        os.system(f"code {file_path}")


def main():
    load_dotenv()
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    retriever = create_tavily_search_api_retriever()
    agent = AgentClassroom(llm, retriever)
    init_state = State(query="日米首脳会談")

    # 初期状態から開始（reporterノード）
    print("\nExecuting reporter node:")
    print("-" * 50)
    state = agent.invoke_node("reporter", init_state)
    print(f"Reporter content:\n{state.reporter_content}")
    print(f"Report ID: {state.report_id}")

    # レポートの解析と保存
    report_content = agent.reporter.parse_report_output(state.reporter_content, state.query)
    print("\nParsed report points:")
    for point in report_content.points:
        print(f"\nPoint {point.id}:")
        print(f"Title: {point.title}")
        print(f"Content: {point.content}")
        if point.source:
            print(f"Source: {point.source.name} ({point.source.url})")
    print("-" * 50)

    # ユーザー入力のシミュレート（要点選択）
    state.point_selection_for_critic = PointSelection(report_id=state.report_id, point_id="1")
    print(
        f"Selected point - Report ID: {state.point_selection_for_critic.report_id}, Point ID: {state.point_selection_for_critic.point_id}"
    )

    # 詳細レポートの生成
    print("\nGenerating detailed report...")
    state = agent.invoke_node("explore_report", state)
    print(f"Current role: {state.current_role}")
    print(f"Report ID: {state.report_id}")
    if state.explored_content:
        print(f"Explored content:\n{state.explored_content}")
    else:
        print("Warning: No explored content generated")
    print("-" * 50)

    # ユーザー入力のシミュレート（トピック選択）
    state.user_selection_of_critic = PointSelection(report_id=state.report_id, point_id="1")

    # 最終的な論点生成
    state = agent.invoke_node("critic", state)
    print("\nCritic points:")
    for i, point in enumerate(state.critic_content.points):
        print(f"\nPoint {i + 1}:")
        print(f"Title: {point.title}")
        print("Cases:")
        for j, case in enumerate(point.cases):
            print(f"  {j + 1}. {case}")

    print("\nExecution completed.")


if __name__ == "__main__":
    main()
