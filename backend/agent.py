from pprint import pprint
from typing import Any

from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_core.language_models import BaseChatModel
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.retrievers import BaseRetriever
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langgraph.graph import StateGraph
from pydantic import BaseModel, Field

from utils import extract_text_from_pdf, text_to_documents

load_dotenv()


def create_pdf_retriever(file_path: str) -> BaseRetriever:
    text = extract_text_from_pdf(file_path)
    filtered_docs = text_to_documents(text)
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    db = Chroma.from_documents(filtered_docs, embeddings)
    return db.as_retriever()


class State(BaseModel):
    query: str = Field(..., description="ユーザーからの質問")
    current_role: str = Field(default="", description="選定された回答ロール")
    reporter_content: str = Field(default="", description="reporterの回答内容")
    critic_content: str = Field(default="", description="criticの回答内容")


class AgentClassroom:
    def __init__(self, llm: BaseChatModel, retriever: BaseRetriever) -> None:
        self.graph = self._create_graph()
        self.retriever = retriever
        self.llm = llm

    def _create_graph(self) -> StateGraph:
        workflow = StateGraph(State)

        workflow.add_node("reporter", self.reporter_node)
        workflow.add_node("critic", self.critic_node)
        workflow.add_edge("reporter", "critic")
        workflow.set_entry_point("reporter")

        return workflow

    def reporter_node(self, state: State) -> dict[str, Any]:
        query = state.query
        retriever = self.retriever

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

        chain: Runnable = {"context": retriever} | prompt | model | StrOutputParser()

        # RAGへの質問
        output = chain.invoke(query)
        generated_text = output

        return {
            "query": query,
            "current_role": "reporter",
            "reporter_content": generated_text,
        }

    def critic_node(self, state: State) -> dict[str, Any]:
        query = state.query
        report_text = state.reporter_content
        context = self.retriever.invoke(report_text)

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

        prompt = PromptTemplate(template=template, input_variables=["report_text", "context"])
        model = self.llm
        chain = prompt | model | StrOutputParser()

        output = chain.invoke({"report_text": report_text, "context": context})
        generated_text = output

        return {"query": query, "current_role": "critic", "critic_content": generated_text}


def main():
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    retriever = create_pdf_retriever("./documents/main.pdf")
    agent = AgentClassroom(llm, retriever)
    compiled = agent.graph.compile()
    init_state = State(query="")
    result = compiled.invoke(init_state)
    pprint(result)


if __name__ == "__main__":
    main()
