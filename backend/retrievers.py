from langchain_chroma import Chroma
from langchain_community.retrievers import TavilySearchAPIRetriever
from langchain_core.retrievers import BaseRetriever
from langchain_openai import OpenAIEmbeddings

from utils import extract_text_from_pdf, text_to_documents


def create_tavily_search_api_retriever() -> TavilySearchAPIRetriever:
    return TavilySearchAPIRetriever(
        k=3, search_depth="advanced", include_raw_content=True, include_domains=[]
    )


def create_pdf_retriever(file_path: str) -> BaseRetriever:
    text = extract_text_from_pdf(file_path)
    filtered_docs = text_to_documents(text)
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    db = Chroma.from_documents(filtered_docs, embeddings)
    return db.as_retriever()


def create_mock_retriever() -> BaseRetriever:
    mocktext = "桃から生まれた桃太郎は、老婆老爺に養われ、鬼ヶ島へ鬼退治に出征、道中遭遇するイヌ、サル、キジをきび団子を褒美に家来とし、鬼の財宝を持ち帰り、郷里に凱旋する"
    mockdocs = text_to_documents(mocktext)
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    return Chroma.from_documents(mockdocs, embeddings).as_retriever()
