from langchain_core.language_models import BaseChatModel
from pydantic import BaseModel, Field

from agent import CriticAgent, CriticContent, PointSelection, ReporterAgent


class State(BaseModel):
    query: str = Field(..., description="ユーザーからの質問")
    current_role: str = Field(default="", description="現在のロール")
    reporter_content: str = Field(default="", description="reporterの初回回答内容")
    report_id: str = Field(default="", description="レポートID")
    point_selection_for_critic: PointSelection = Field(
        default=None, description="ユーザーの要点選択"
    )
    explored_content: str = Field(default="", description="選択された要点の詳細レポート")
    user_selection_of_critic: PointSelection = Field(
        default=None, description="ユーザーのcritic論点選択"
    )
    critic_content: CriticContent = Field(
        default_factory=CriticContent, description="criticの回答内容"
    )
    ta_feedback_content: str = Field(default="", description="teaching assistant からのfeedback")
    thread_id: str = Field(default="", description="スレッドID")


class ReportController:
    def __init__(self, llm: BaseChatModel) -> None:
        self.reporter = ReporterAgent(llm)

    def post(self, state: State) -> State:
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


class ExploreController:
    def __init__(self, llm: BaseChatModel) -> None:
        self.reporter = ReporterAgent(llm)

    def post(self, state: State) -> State:
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


class CriticController:
    def __init__(self, llm: BaseChatModel) -> None:
        self.critic = CriticAgent(llm)

    def post(self, state: State) -> State:
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
