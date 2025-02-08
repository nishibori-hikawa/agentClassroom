from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, List, TypedDict

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
    FIX_CRITIQUE_TEMPLATE,
)

if TYPE_CHECKING:
    from langchain_core.runnables import Runnable


class ReporterAgent:
    def __init__(self, retriever: BaseRetriever, llm: BaseChatModel) -> None:
        self.llm = llm
        self.retriever = retriever

    def generate_report(self, query: str) -> str:
        prompt = PromptTemplate(
            template=GENERATE_REPORT_TEMPLATE, input_variables=["context", "question"]
        )
        model = self.llm

        chain: Runnable = {"context": self.retriever} | prompt | model | StrOutputParser()

        return chain.invoke(query)

    async def generate_report_stream(self, query: str) -> AsyncGenerator[str, None]:
        prompt = PromptTemplate(
            template=GENERATE_REPORT_TEMPLATE, input_variables=["context", "question"]
        )
        model = self.llm

        # Retrieve context
        context = await self.retriever.ainvoke(query) or []

        # Format the prompt
        formatted_prompt = prompt.format(context=context, question=query)

        # Create the chain for streaming
        chain = model | StrOutputParser()

        async for chunk in chain.astream(formatted_prompt):
            yield chunk

    def check_cases(self, case: str) -> str:
        prompt = PromptTemplate(template=CHECK_CASES_TEMPLATE, input_variables=["context", "case"])
        try:
            content = self.retriever.invoke(case)
            if not content:
                content = [
                    {"page_content": "No relevant information found for this case.", "metadata": {}}
                ]
        except Exception as e:
            content = [{"page_content": f"Error retrieving information: {str(e)}", "metadata": {}}]

        model = self.llm
        chain: Runnable = prompt | model | StrOutputParser()
        return chain.invoke({"context": content, "case": case})


class CriticPoint(BaseModel):
    title: str
    cases: list[str]


class CriticContent(BaseModel):
    points: list[CriticPoint] = Field(default_factory=list)


class CriticAgent:
    def __init__(self, llm: BaseChatModel) -> None:
        self.llm = llm

    def generate_critique(
        self,
        report_text: str,
        critic_content: CriticContent,
        critic_content_feedback: str,
    ) -> dict:
        parser = PydanticOutputParser(pydantic_object=CriticContent)
        prompt = ChatPromptTemplate.from_template(
            template=CRITIQUE_TEMPLATE,
        )

        # Create chain
        chain = prompt | self.llm | parser

        # Execute chain and return result
        return chain.invoke(
            {
                "format_instructions": parser.get_format_instructions(),
                "report_text": report_text,
                "critic_content": critic_content.model_dump_json(),
                "critic_content_feedback": critic_content_feedback,
            }
        )


class TeachingAssistantAgent:
    def __init__(self, llm: BaseChatModel) -> None:
        self.llm = llm

    def feedback_critic_content(self, critic_content: CriticContent) -> str:
        prompt = ChatPromptTemplate.from_template(
            template=FIX_CRITIQUE_TEMPLATE,
        )
        model = self.llm

        chain: Runnable = prompt | model | StrOutputParser()

        return chain.invoke({"critic_content": critic_content.model_dump_json()})


if __name__ == "__main__":
    load_dotenv()
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    agent = CriticAgent(llm)
    report_text = "国際機関の関与は、国際政治の安定と平和を促進するために重要である。なぜなら、国際機関は各国の間での紛争を解決し、国際的な課題に対応するための重要なツールであるからである。例えば、ソマリアは国際機関の関与を受けて、紛争を解決し、平和を促進している。"
    print(agent.generate_critique(report_text))
