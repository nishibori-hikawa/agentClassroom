import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from graph import AgentClassroom, State
from retrievers import create_tavily_search_api_retriever

load_dotenv()

app = FastAPI(
    title="LangChain Server",
    version="1.0",
    description="LangchainのRunnableインターフェースを使ったシンプルなAPIサーバー",
)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
retriever = create_tavily_search_api_retriever()
graph = AgentClassroom(llm, retriever)


class GraphRequest(BaseModel):
    first_call: bool
    state: State
    thread_id: int


@app.post("/graph")
async def invoke(request: GraphRequest) -> State:
    state = request.state
    config = {"configurable": {"thread_id": request.thread_id}}
    try:
        if request.first_call:
            result = graph.graph.invoke(state.model_dump(), config)
        else:
            graph.graph.update_state(values=state.model_dump(), config=config)
            result = graph.graph.invoke(None, config)
        return result
    except Exception as e:
        logging.error(f"Error invoking graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="localhost", port=8080)
