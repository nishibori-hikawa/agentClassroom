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

from templates import CHECK_CASES_TEMPLATE, CRITIQUE_TEMPLATE, GENERATE_REPORT_TEMPLATE
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
    topic: str
    points: list[ReporterPoint] = Field(default_factory=list)


class ReporterAgent:
    def __init__(self, llm: BaseChatModel) -> None:
        self.llm = llm
        self.news_retriever = create_news_retriever()
        self.general_retriever = create_general_retriever()

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

    def parse_report_output(self, text: str) -> ReportContent:
        """Parse the reporter's markdown output into a structured format."""
        lines = text.strip().split("\n")
        points = []
        current_point = None

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if line.startswith("1.") or line.startswith("2.") or line.startswith("3."):
                # Extract title from the bold markdown format
                title = line.split("**")[1].strip("*[] ")
                current_point = {
                    "id": f"point_{len(points) + 1}",
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
                # Add the completed point to points list
                points.append(
                    ReporterPoint(
                        id=current_point["id"],
                        title=current_point["title"],
                        content=current_point["content"].strip(),
                        source=current_point["source"],
                    )
                )
            elif current_point:
                # Accumulate content lines
                current_point["content"] += line + " "

        return ReportContent(topic="", points=points)


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
        report_content = reporter.parse_report_output(accumulated_output)

        # 構造化されたデータの内容を確認
        print("\nParsed Report Content:")
        for point in report_content.points:
            print(f"\nPoint ID: {point.id}")
            print(f"Title: {point.title}")
            print(f"Content: {point.content}")
            if point.source:
                print(f"Source: {point.source.name} ({point.source.url})")
            print("-" * 50)

        print("\nTest completed.")

    # Run the test
    asyncio.run(test_reporter())
