import logging
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI
from langchain_google_vertexai import ChatVertexAI
from pydantic import BaseModel

from graph import AgentClassroom, State, PointSelection
from retrievers import create_tavily_search_api_retriever

load_dotenv()

app = FastAPI(
    title="LangChain Server",
    version="1.0",
    description="Agent Classroom API Server",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# llm = ChatVertexAI()
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
)

retriever = create_tavily_search_api_retriever()
graph = AgentClassroom(llm, retriever)


class QueryRequest(BaseModel):
    query: str
    thread_id: int


class PointSelectionRequest(BaseModel):
    state: State
    point_selection_for_critic: PointSelection
    thread_id: int
    is_yes_case: Optional[bool] = None


@app.post("/reporter")
async def reporter(request: QueryRequest) -> State:
    """初回の要点を生成するエンドポイント"""
    try:
        initial_state = State(query=request.query, thread_id=str(request.thread_id))
        result = graph.invoke_node("reporter", initial_state)
        return result
    except Exception as e:
        logging.error(f"Error in reporter node: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/explore")
async def explore(request: PointSelectionRequest) -> State:
    """選択された要点の詳細を生成するエンドポイント"""
    try:
        state = request.state
        state.point_selection_for_critic = request.point_selection_for_critic
        result = graph.invoke_node("explore_report", state)
        return result
    except Exception as e:
        logging.error(f"Error in explore node: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/critic")
async def critic(request: PointSelectionRequest) -> State:
    """論点を生成するエンドポイント"""
    try:
        state = request.state
        state.point_selection_for_critic = request.point_selection_for_critic
        state.user_selection_of_critic = request.point_selection_for_critic
        print(
            f"Debug - Critic endpoint: Processing point_id {request.point_selection_for_critic.point_id}"
        )
        print(
            f"Debug - Critic endpoint: Explored content length: {len(state.explored_content) if state.explored_content else 0}"
        )
        print(
            f"Debug - Critic endpoint: First 100 chars of explored content: {state.explored_content[:100] if state.explored_content else 'No content'}"
        )
        result = graph.invoke_node("critic", state)
        return result
    except Exception as e:
        logging.error(f"Error in critic node: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/investigate_case")
async def investigate_case(request: PointSelectionRequest) -> State:
    """Yes/Noの事例を調査するエンドポイント"""
    try:
        print("\nDebug - Investigate Case Endpoint:")
        print(f"Request data: {request.dict()}")
        print(f"State data: {request.state.dict()}")
        print(f"Point selection: {request.point_selection_for_critic}")
        print(f"Is Yes Case: {request.is_yes_case}")

        state = request.state
        state.point_selection_for_critic = request.point_selection_for_critic
        state.is_yes_case = request.is_yes_case

        print(f"Debug - State after update:")
        print(f"Point selection: {state.point_selection_for_critic}")
        print(f"Is Yes Case: {state.is_yes_case}")

        result = graph.invoke_node("investigate_cases", state)
        return result
    except Exception as e:
        logging.error(f"Error in investigate_cases node: {e}")
        print(f"Debug - Error occurred: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="localhost", port=8000, reload=True)
