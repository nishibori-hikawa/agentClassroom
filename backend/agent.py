from typing import TYPE_CHECKING, List, TypedDict

from dotenv import load_dotenv
from langchain_core.language_models import BaseChatModel
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser, StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.retrievers import BaseRetriever
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI
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

    def check_cases(self, case: str) -> str:
        template = '''
        あなたは国際政治演習に参加している報告担当の生徒です。
        以下の資料を元に、{case}の言説をサポートする具体的事例について報告してください。

        資料: """
        {context}
        """

        注意:
        - 500字以内で、専門用語は高校生でもわかるように
        - 要点を箇条書きで整理したあと、結論を述べる
        '''

        prompt = PromptTemplate(template=template, input_variables=["context", "case"])
        content = self.retriever.invoke(case)
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

    def generate_critique(self, report_text: str) -> dict:
        parser = PydanticOutputParser(pydantic_object=CriticContent)

        # Create prompt template
        template = (
            "あなたは国際政治演習に参加している生徒で、批判的視点からの論点を抽出する専門家です。\n"
            "以下の報告文について、論点を3つ抽出してください。\n"
            "ただし、各論点には2つの対立する視点を用意してください。\n\n"
            "【フォーマット】\n"
            "{format_instructions}\n"
            "\n"
            "【報告文】:\n"
            "{report_text}\n"
            "\n"
            "注意:\n"
            "- JSON以外の文字列は出力しない\n"
            "- 配列名は points\n"
            "- 各オブジェクトは title(論点) と cases(文字列配列) を含む\n"
            "- 最初の2つのtitleは「〜か？」のようなYes/Noで答えられる疑問形にする\n"
            "  - これらのcasesは「Yesの場合: 〜」「Noの場合: 〜」のように明確に分ける\n"
            "- 3つ目のtitleは「〜は何か？」「〜をどう考えるか？」のようなOpen Questionにする\n"
            "  - casesは対立する2つの異なる視点を示す\n"
            "- 論点同士が重複しないよう、以下の異なる観点から考える:\n"
            "  1) 政策や制度の実効性に関する論点\n"
            "  2) 国際社会における正当性や公平性に関する論点\n"
            "  3) 報告文で言及されていない長期的な影響や課題に関する論点"
        )

        prompt = ChatPromptTemplate.from_template(
            template=template,
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )

        # Create chain
        chain = prompt | self.llm | parser

        # Execute chain and return result
        return chain.invoke({"report_text": report_text})


if __name__ == "__main__":
    load_dotenv()
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    agent = CriticAgent(llm)
    report_text = "国際機関の関与は、国際政治の安定と平和を促進するために重要である。なぜなら、国際機関は各国の間での紛争を解決し、国際的な課題に対応するための重要なツールであるからである。例えば、ソマリアは国際機関の関与を受けて、紛争を解決し、平和を促進している。"
    print(agent.generate_critique(report_text))
