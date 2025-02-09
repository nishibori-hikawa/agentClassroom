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

    load_dotenv()
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    async def test_reporter():
        reporter = ReporterAgent(llm)
        query = "ウクライナ戦争が国際秩序に与える影響について"
        print(f"\nTesting reporter with query: {query}\n")
        print("Streaming output:")
        async for chunk in reporter.generate_report_stream(query):
            print(chunk, end="", flush=True)
        print("\n\nTest completed.")

    # Run the test
    asyncio.run(test_reporter())
