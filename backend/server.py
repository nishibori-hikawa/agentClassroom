import logging
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
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

# CORSミドルウェアの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # フロントエンドのオリジン
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GPT-4-turboモデルを使用
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
)

# 検索結果を制限したリトリーバーを作成
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


async def event_stream(request: GraphRequest):
    state = request.state
    config = {"configurable": {"thread_id": request.thread_id}}
    try:
        if request.first_call:
            for chunk in graph.graph.stream(state.model_dump(), config):
                for node_name, node_results in chunk.items():
                    for message in node_results.get("messages", []):
                        if not message.get("content"):
                            continue
                        event_str = "event: ai_event"
                        data_str = f"data: {message['content']}"
                        yield f"{event_str}\n{data_str}\n\n"
        else:
            graph.graph.update_state(values=state.model_dump(), config=config)
            for chunk in graph.graph.stream(None, config):
                for node_name, node_results in chunk.items():
                    for message in node_results.get("messages", []):
                        if not message.get("content"):
                            continue
                        event_str = "event: ai_event"
                        data_str = f"data: {message['content']}"
                        yield f"{event_str}\n{data_str}\n\n"
    except Exception as e:
        logging.error(f"Error invoking graph: {e}")
        yield f"event: error\ndata: {str(e)}\n\n"


@app.post("/stream")
async def stream(request: GraphRequest) -> StreamingResponse:
    return StreamingResponse(event_stream(request=request), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="localhost", port=8000, reload=True)
