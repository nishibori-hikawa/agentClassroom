from langchain_chroma import Chroma
from langchain_community.retrievers import TavilySearchAPIRetriever
from langchain_core.retrievers import BaseRetriever
from langchain_openai import OpenAIEmbeddings
# from langchain_google_community import VertexAISearchRetriever
# import os

from utils import extract_text_from_pdf, text_to_documents

# # Define trusted news sources
# NEWS_SEARCH_SOURCES = ["bbc.com", "cnn.com", "reuters.com", "theguardian.com", "aljazeera.com"]


def create_news_retriever() -> TavilySearchAPIRetriever:
    """Create a retriever specifically for news sources"""
    return TavilySearchAPIRetriever(
        k=3,
        search_depth="advanced",
        topic="news",
        include_raw_content=True,
    )


def create_general_retriever() -> TavilySearchAPIRetriever:
    """Create a general-purpose retriever without domain restrictions"""
    return TavilySearchAPIRetriever(
        k=3,
        search_depth="advanced",
        include_raw_content=True,
    )


# Deprecated: Use create_news_retriever() or create_general_retriever() instead
def create_tavily_search_api_retriever() -> TavilySearchAPIRetriever:
    return create_news_retriever()


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


# def create_vertex_ai_search_retriever() -> BaseRetriever:
#     return VertexAISearchRetriever(
#         project_id=os.getenv("GOOGLE_CLOUD_PROJECT_ID"),
#         location_id=os.getenv("GOOGLE_CLOUD_LOCATION"),
#         data_store_id=os.getenv("VERTEX_AI_SEARCH_DATASTORE_ID"),
#         max_documents=3,
#         engine_data_type=2,  # Website data type
#         get_extractive_answers=True,
#         max_extractive_answer_count=3,
#         max_extractive_segment_count=1,
#         query_expansion_condition=2,  # Enable automatic query expansion
#     )
