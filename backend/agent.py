from typing import TYPE_CHECKING

from langchain_core.language_models import BaseChatModel
from langchain_core.output_parsers import PydanticOutputParser, StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.retrievers import BaseRetriever
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from langchain_core.runnables import Runnable


class ReporterAgent:
    def __init__(self, retriever: BaseRetriever, llm: BaseChatModel) -> None:
        self.llm = llm
        self.retriever = retriever

    def generate_report(self, query: str) -> str:
        template = '''
        あなたは国際政治演習に参加している報告担当の生徒です。
        以下の資料を元に、簡潔にレポートを作成してください。

        資料: """
        {context}
        """

        注意:
        - 500字以内で、専門用語は高校生でもわかるように
        - 要点を箇条書きで整理したあと、結論を述べる
        '''

        prompt = PromptTemplate(template=template, input_variables=["context", "question"])
        model = self.llm

        chain: Runnable = {"context": self.retriever} | prompt | model | StrOutputParser()

        return chain.invoke(query)


class CriticContent(BaseModel):
    pros: str = Field(..., description="論点の利点")
    cons: str = Field(..., description="論点の欠点")


class CriticAgent:
    def __init__(self, llm: BaseChatModel, retriever: BaseRetriever) -> None:
        self.llm = llm
        self.retriever = retriever

    def generate_critique(self, report_text: str) -> str:
        template = '''
        あなたは国際政治演習に参加している生徒で、批判的視点からの論点を抽出する専門家です。
        報告文: {report_text} を読み、資料をもとに以下の観点で論点を3つ抽出してください。
        1) 政策面・政治制度面の課題
        2) 国際的対立や協調の要因
        3) その論文（報告）では省略されている可能性が高い視点

        資料: """
        {context}
        """

        出力は「論点n: ...」のように箇条書きで3つに限定してください。
        各論点は簡潔に、100文字以内でまとめること。
        '''

        parser = PydanticOutputParser(pydantic_object=CriticContent)
        context = self.retriever.invoke(report_text)
        prompt = PromptTemplate(
            template=template,
            input_variables=["report_text", "context"],
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )
        model = self.llm
        chain = prompt | model

        return chain.invoke({"report_text": report_text, "context": context})


if __name__ == "__main__":
    from langchain_openai import ChatOpenAI
    from retrievers import create_pdf_retriever

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    retriever = create_pdf_retriever("./documents/main.pdf")

    agent = CriticAgent(llm, retriever)
    report_text = "This is a sample report text."
    print(agent.generate_critique(report_text))
