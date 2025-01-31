from dotenv import load_dotenv
from fastapi import FastAPI
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langserve import add_routes

from graph import AgentClassroom
from retrievers import create_pdf_retriever

load_dotenv()

app = FastAPI(
    title="LangChain Server",
    version="1.0",
    description="LangchainのRunnableインターフェースを使ったシンプルなAPIサーバー",
)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
retriever = create_pdf_retriever("./documents/main.pdf")
memory = MemorySaver()
graph = AgentClassroom(llm, retriever, memory)

add_routes(
    app,
    llm,
    path="/openai",
)

add_routes(
    app,
    graph.graph,
    path="/graph",
)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="localhost", port=8080)
