import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from agent import PointSelection
from controller import CriticController, ExploreController, ReportController, State

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

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
)

reporter_controller = ReportController(llm=llm)
explore_controller = ExploreController(llm=llm)
critic_controller = CriticController(llm=llm)


class QueryRequest(BaseModel):
    query: str
    thread_id: int


class PointSelectionRequest(BaseModel):
    state: State
    point_selection_for_critic: PointSelection
    thread_id: int


@app.post("/reporter")
async def reporter(request: QueryRequest) -> State:
    """初回の要点を生成するエンドポイント"""
    try:
        initial_state = State(query=request.query, thread_id=str(request.thread_id))
        return reporter_controller.post(initial_state)
    except Exception as e:
        logging.error(f"Error in reporter node: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/explore")
async def explore(request: PointSelectionRequest) -> State:
    """選択された要点の詳細を生成するエンドポイント"""
    try:
        state = request.state
        state.point_selection_for_critic = request.point_selection_for_critic
        return explore_controller.post(state)
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
        return critic_controller.post(state)
    except Exception as e:
        logging.error(f"Error in critic node: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="localhost", port=8000, reload=True)
