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

    async def generate_report_stream(self, query: str) -> AsyncGenerator[str, None]:
        # Create the prompt
        prompt = PromptTemplate(
            template=GENERATE_REPORT_TEMPLATE,
            input_variables=["context", "question"],
        )
        model = self.llm

        # First get the context using news retriever
        try:
            context = await self.news_retriever.ainvoke(query)
            if not context:
                context = [{"page_content": "No relevant information found.", "metadata": {}}]
        except Exception as e:
            context = [{"page_content": "Error retrieving information.", "metadata": {}}]

        # Format the prompt first
        formatted_prompt = prompt.format(context=context, question=query)

        # Create the chain for streaming
        chain = (model | StrOutputParser()).with_config({"tags": ["reporter_stream"]})

        try:
            async for chunk in chain.astream_events(
                formatted_prompt,
                version="v1",
            ):
                if (
                    chunk["event"] == "on_chat_model_stream"
                    and chunk.get("data", {}).get("chunk", {}).content
                ):
                    content = chunk["data"]["chunk"].content
                    yield content

        except Exception as e:
            yield f"Error during streaming: {str(e)}"

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

    async def check_cases_stream(self, case: str) -> AsyncGenerator[str, None]:
        prompt = PromptTemplate(template=CHECK_CASES_TEMPLATE, input_variables=["context", "case"])
        model = self.llm

        # First get the context
        try:
            content = await self.retriever.ainvoke(case)
            if not content:
                content = [
                    {"page_content": "No relevant information found for this case.", "metadata": {}}
                ]
        except Exception as e:
            content = [{"page_content": f"Error retrieving information: {str(e)}", "metadata": {}}]

        # Format the prompt first
        formatted_prompt = prompt.format(context=content, case=case)

        # Create the chain for streaming
        chain = (model | StrOutputParser()).with_config({"tags": ["check_cases_stream"]})

        try:
            async for chunk in chain.astream_events(
                formatted_prompt,
                version="v1",
            ):
                if (
                    chunk["event"] == "on_chat_model_stream"
                    and chunk.get("data", {}).get("chunk", {}).content
                ):
                    content = chunk["data"]["chunk"].content
                    yield content
        except Exception as e:
            yield f"Error during streaming: {str(e)}"

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

    async def generate_detailed_report_stream(
        self, report_id: str, point_id: str
    ) -> AsyncGenerator[str, None]:
        """選択されたポイントについて詳細な報告を生成する"""
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
            context = await self.news_retriever.ainvoke(search_query)
            if not context:
                context = [{"page_content": "No relevant information found.", "metadata": {}}]
        except Exception as e:
            context = [{"page_content": "Error retrieving information.", "metadata": {}}]

        # プロンプトのフォーマット
        formatted_prompt = prompt.format(
            context=context,
            title=point.title,
            content=point.content,
        )

        # ストリーミング用のチェーンを作成
        chain = (model | StrOutputParser()).with_config({"tags": ["detailed_report_stream"]})

        try:
            async for chunk in chain.astream_events(
                formatted_prompt,
                version="v1",
            ):
                if (
                    chunk["event"] == "on_chat_model_stream"
                    and chunk.get("data", {}).get("chunk", {}).content
                ):
                    content = chunk["data"]["chunk"].content
                    yield content
        except Exception as e:
            yield f"Error during streaming: {str(e)}"


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

        # 出力を蓄積するための変数
        accumulated_output = ""
        print("Streaming output:")
        async for chunk in reporter.generate_report_stream(query):
            accumulated_output += chunk
            print(chunk, end="", flush=True)

        print("\n\nParsing the output:")
        report_content = reporter.parse_report_output(accumulated_output, query)

        # 構造化されたデータの内容を確認
        print("\nParsed Report Content:")
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

        # ポイント選択のテスト
        try:
            print("\nTesting point selection:")
            selection = reporter.select_point(report_content.id, "1")
            print(f"Selected point - Report ID: {selection.report_id}")
            print(f"Point ID: {selection.point_id}")
            print(f"Selected at: {selection.selected_at}")

            # 詳細レポートの生成テスト
            print("\nGenerating detailed report for selected point:")
            print("-" * 50)
            async for chunk in reporter.generate_detailed_report_stream(
                selection.report_id, selection.point_id
            ):
                print(chunk, end="", flush=True)
            print("\n" + "-" * 50)

        except ValueError as e:
            print(f"Error: {e}")

        print("\nTest completed.")

    # Run the test
    asyncio.run(test_reporter())
