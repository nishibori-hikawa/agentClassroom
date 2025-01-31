from typing import TYPE_CHECKING

import dotenv
from langchain_core.language_models import BaseChatModel
from langchain_core.output_parsers import PydanticOutputParser, StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.retrievers import BaseRetriever
from langchain_core.runnables import Runnable

dotenv.load_dotenv()

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


# class CriticContent(BaseModel):
#     pros: str = Field(..., description="論点の利点")
#     cons: str = Field(..., description="論点の欠点")


class CriticAgent:
    def __init__(self, llm: BaseChatModel) -> None:
        self.llm = llm

    def generate_critique(self, report_text: str) -> dict:
        from langchain.output_parsers import ResponseSchema, StructuredOutputParser
        from langchain.prompts import ChatPromptTemplate

        # Define the response schema for structured output
        response_schemas = [
            ResponseSchema(
                name="points",
                description=(
                    "Array of 3 discussion points, each with a 'title' and a 'cases' array of 2 strings. "
                    "First two points should be yes/no questions, third point should be an open question. "
                    "Example: [{ title: 'Is...?', cases: ['Yes case: ...', 'No case: ...']}, {...}, { title: 'What are...?', cases: ['View A: ...', 'View B: ...']}]"
                ),
                type="array(objects)",
            ),
        ]

        # Create parser
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

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
        result = chain.invoke({"report_text": report_text})

        return result


if __name__ == "__main__":
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(
        model="gpt-4o-mini", temperature=0, openai_api_key=dotenv.get_key(".env", "OPENAI_API_KEY")
    )

    agent = CriticAgent(llm)
    report_text = "国際機関の関与は、国際政治の安定と平和を促進するために重要である。なぜなら、国際機関は各国の間での紛争を解決し、国際的な課題に対応するための重要なツールであるからである。例えば、ソマリアは国際機関の関与を受けて、紛争を解決し、平和を促進している。"
    print(agent.generate_critique(report_text))
