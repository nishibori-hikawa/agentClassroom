from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, List, TypedDict
import json

from dotenv import load_dotenv
from langchain.prompts import ChatPromptTemplate
from langchain_core.language_models import BaseChatModel
from langchain_core.output_parsers import PydanticOutputParser, StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.retrievers import BaseRetriever
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from datetime import datetime

from templates import (
    CHECK_CASES_TEMPLATE,
    CRITIQUE_TEMPLATE,
    GENERATE_REPORT_TEMPLATE,
    GENERATE_DETAILED_REPORT_TEMPLATE,
)
from retrievers import create_news_retriever, create_general_retriever

if TYPE_CHECKING:
    from langchain_core.runnables import Runnable


class Source(BaseModel):
    name: str
    url: str


class ReporterPoint(BaseModel):
    id: str
    title: str
    content: str
    source: Source


class ReportContent(BaseModel):
    id: str
    topic: str
    points: list[ReporterPoint] = Field(default_factory=list)


class PointSelection(BaseModel):
    """ユーザーによるポイント選択を表すモデル"""

    report_id: str
    point_id: str
    selected_at: str = Field(default_factory=lambda: datetime.now().strftime("%Y%m%d_%H%M%S"))


class ReporterAgent:
    def __init__(self, llm: BaseChatModel) -> None:
        self.llm = llm
        self.news_retriever = create_news_retriever()
        self.general_retriever = create_general_retriever()
        self.reports: dict[str, ReportContent] = {}  # レポートを保持するための辞書

    def select_point(self, report_id: str, point_id: str) -> PointSelection:
        """レポートから特定のポイントを選択する"""
        if report_id not in self.reports:
            raise ValueError(f"Report with ID {report_id} not found")

        report = self.reports[report_id]
        # 指定されたpoint_idが存在するか確認
        if not any(point.id == point_id for point in report.points):
            raise ValueError(f"Point with ID {point_id} not found in report {report_id}")

        return PointSelection(report_id=report_id, point_id=point_id)


    def generate_report(self, query: str) -> str:
        """非ストリーミングバージョンのレポート生成メソッド"""
        # Create the prompt
        prompt = PromptTemplate(
            template=GENERATE_REPORT_TEMPLATE,
            input_variables=["context", "question"],
        )
        model = self.llm

        # Get the context using news retriever
        try:
            context = self.news_retriever.invoke(query)
            if not context:
                context = [{"page_content": "No relevant information found.", "metadata": {}}]
        except Exception as e:
            context = [{"page_content": "Error retrieving information.", "metadata": {}}]

        # Create and execute the chain
        chain = prompt | model | StrOutputParser()
        return chain.invoke({"context": context, "question": query})

    def generate_detailed_report(self, report_id: str, point_id: str) -> str:
        """非ストリーミングバージョンの詳細レポート生成メソッド"""
        # レポートとポイントの取得
        if report_id not in self.reports:
            raise ValueError(f"Report with ID {report_id} not found")

        report = self.reports[report_id]
        point = next((p for p in report.points if p.id == point_id), None)
        if not point:
            raise ValueError(f"Point with ID {point_id} not found in report {report_id}")

        # プロンプトの作成
        prompt = PromptTemplate(
            template=GENERATE_DETAILED_REPORT_TEMPLATE,
            input_variables=["context", "title", "content"],
        )
        model = self.llm

        # コンテキストの取得
        search_query = point.title  # タイトルのみを検索クエリとして使用
        try:
            context = self.news_retriever.invoke(search_query)
            if not context:
                context = [{"page_content": "No relevant information found.", "metadata": {}}]
        except Exception as e:
            context = [{"page_content": "Error retrieving information.", "metadata": {}}]

        # Create and execute the chain
        chain = prompt | model | StrOutputParser()
        return chain.invoke(
            {
                "context": context,
                "title": point.title,
                "content": point.content,
            }
        )

    def check_cases(self, case: str) -> str:
        prompt = PromptTemplate(template=CHECK_CASES_TEMPLATE, input_variables=["context", "case"])
        try:
            content = self.general_retriever.invoke(case)
            if not content:
                content = [
                    {"page_content": "No relevant information found for this case.", "metadata": {}}
                ]
        except Exception as e:
            content = [{"page_content": f"Error retrieving information: {str(e)}", "metadata": {}}]

        model = self.llm
        chain: Runnable = prompt | model | StrOutputParser()
        return chain.invoke({"context": content, "case": case})

    def parse_report_output(self, text: str, query: str) -> ReportContent:
        """Parse the reporter's markdown output into a structured format."""
        lines = text.strip().split("\n")
        points = []
        current_point = None

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if line.startswith("1.") or line.startswith("2.") or line.startswith("3."):
                # 前のポイントがあれば追加
                if current_point:
                    points.append(
                        ReporterPoint(
                            id=current_point["id"],
                            title=current_point["title"],
                            content=current_point["content"].strip(),
                            source=current_point["source"],
                        )
                    )
                # 新しいポイントの開始
                title = line.split("**")[1].strip("*[] ")
                current_point = {
                    "id": str(len(points) + 1),
                    "title": title,
                    "content": "",
                    "source": None,
                }
            elif current_point and "[出典:" in line:
                # Extract source information
                source_parts = line.strip("[]").split("](")
                name = source_parts[0].replace("出典:", "").strip()
                url = source_parts[1].strip(")")
                current_point["source"] = Source(name=name, url=url)
            elif current_point:
                # Accumulate content lines
                current_point["content"] += line + " "

        # 最後のポイントを追加
        if current_point:
            points.append(
                ReporterPoint(
                    id=current_point["id"],
                    title=current_point["title"],
                    content=current_point["content"].strip(),
                    source=current_point["source"],
                )
            )

        # Generate a unique ID for the report using timestamp
        from datetime import datetime

        report_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_content = ReportContent(id=report_id, topic=query, points=points)

        # レポートを保存
        self.reports[report_id] = report_content

        return report_content


class CriticPoint(BaseModel):
    title: str
    cases: list[str]


class CriticContent(BaseModel):
    points: list[CriticPoint] = Field(default_factory=list)


class CriticAgent:
    def __init__(self, llm: BaseChatModel) -> None:
        self.llm = llm

    def generate_critique(self, report_text: str) -> dict:
        parser = PydanticOutputParser(pydantic_object=CriticContent)
        prompt = ChatPromptTemplate.from_template(
            template=CRITIQUE_TEMPLATE,
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )

        # Create chain
        chain = prompt | self.llm | parser

        # Execute chain and return result
        return chain.invoke({"report_text": report_text})


if __name__ == "__main__":
    import asyncio
    from pprint import pprint
    from datetime import datetime

    load_dotenv()
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    async def test_reporter():
        reporter = ReporterAgent(llm)
        query = "ウクライナ戦争が国際秩序に与える影響について"
        print(f"\nTesting reporter with query: {query}\n")

        # 非ストリーミングバージョンのテスト
        print("Testing non-streaming report generation:")
        print("-" * 50)
        report_text = reporter.generate_report(query)
        print(report_text)
        print("-" * 50)

        # レポートの解析テスト
        print("\nParsing the non-streaming output:")
        report_content = reporter.parse_report_output(report_text, query)
        print(f"Report ID: {report_content.id}")
        print(f"Topic: {report_content.topic}")
        print("\nPoints:")
        for point in report_content.points:
            print(f"\nPoint ID: {point.id}")
            print(f"Title: {point.title}")
            print(f"Content: {point.content}")
            if point.source:
                print(f"Source: {point.source.name} ({point.source.url})")
            print("-" * 50)

        try:
            print("\nTesting point selection:")
            selection = reporter.select_point(report_content.id, "1")
            print(f"Selected point - Report ID: {selection.report_id}")
            print(f"Point ID: {selection.point_id}")
            print(f"Selected at: {selection.selected_at}")

            # 詳細レポートの非ストリーミング生成テスト
            print("\nGenerating detailed report (non-streaming) for selected point:")
            print("-" * 50)
            detailed_report = reporter.generate_detailed_report(
                selection.report_id, selection.point_id
            )
            print(detailed_report)
            print("-" * 50)

        except ValueError as e:
            print(f"Error: {e}")

        print("\nTest completed.")

    # Run the test
    asyncio.run(test_reporter())
