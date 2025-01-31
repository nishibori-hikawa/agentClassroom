from langchain_chroma import Chroma
from langchain_community.retrievers import TavilySearchAPIRetriever
from langchain_core.retrievers import BaseRetriever
from langchain_openai import OpenAIEmbeddings

from utils import extract_text_from_pdf, text_to_documents


def create_tavily_search_api_retriever() -> TavilySearchAPIRetriever:
    return TavilySearchAPIRetriever(k=3)


def create_pdf_retriever(file_path: str) -> BaseRetriever:
    text = extract_text_from_pdf(file_path)
    filtered_docs = text_to_documents(text)
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    db = Chroma.from_documents(filtered_docs, embeddings)
    return db.as_retriever()
