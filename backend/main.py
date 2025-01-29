# main.py
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.critic_agent import CriticAgent
from agents.reporter_agent import ReporterAgent
from agents.ta_agent import TeachingAssistantAgent

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

app = FastAPI()

origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

reporter = ReporterAgent()
critic = CriticAgent()
ta = TeachingAssistantAgent()

conversation_log = []


class TopicRequest(BaseModel):
    user_topic: str
    mode: str = "auto"  # "auto" or "interactive"


class CriticRequest(BaseModel):
    report_text: str
    fact_check_results: dict = None


class TARequest(BaseModel):
    report_text: str
    points: list[str]
    additional_note: str = ""


class ChainRequest(BaseModel):
    topic: str
    additional_note: str = ""


class UserSpeakRequest(BaseModel):
    content: str
    feedback: str = None


class ReporterResponse(BaseModel):
    report_text: str
    user_feedback: str = None


class CriticResponse(BaseModel):
    points: list[str]
    user_feedback: str = None


@app.get("/")
def read_root():
    return {"message": "AgentClassroom2 APIへようこそ！"}


@app.post("/report")
def report(request: TopicRequest):
    report_text = reporter.report(request.topic)
    return {"topic": request.topic, "report": report_text}


@app.post("/critic")
def critic_endpoint(request: CriticRequest):
    points = critic.extract_points(request.report_text)
    return {"points": points, "fact_check_results": request.fact_check_results}


@app.post("/ta")
def ta_endpoint(request: TARequest):
    ta_message = ta.facilitate_discussion(
        request.report_text,
        request.points,
        request.additional_note,
    )
    return {"ta_message": ta_message}


@app.post("/chain")
def chain_endpoint(request: ChainRequest):
    # 1. Reporter to get a report
    report_text = reporter.report(request.topic)
    # 2. Critic to extract points from that report
    points = critic.extract_points(report_text)
    # 3. TA to facilitate discussion based on the report and points
    ta_message = ta.facilitate_discussion(report_text, points, request.additional_note)
    return {
        "topic": request.topic,
        "report": report_text,
        "points": points,
        "ta_message": ta_message,
    }


@app.post("/user_speak")
def user_speak(request: UserSpeakRequest):
    conversation_log.append({"role": "user", "content": request.content})
    # For now, we just call TA with the latest user content.
    # More advanced logic (involving Reporter or Critic) can be added later.
    ta_reply = ta.facilitate_discussion(
        report_text=request.content,
        points=[],
        additional_note="ユーザーからの質問です。",
    )
    conversation_log.append({"role": "ta", "content": ta_reply})
    return {"ta_reply": ta_reply}


@app.post("/run_discussion")
def run_discussion(request: TopicRequest):
    if request.mode == "auto":
        # 自動モード: 全エージェントを連続実行
        report_text = reporter.report(request.user_topic)
        points = critic.extract_points(report_text)
        ta_message = ta.facilitate_discussion(report_text, points)
        return {
            "status": "completed",
            "report": report_text,
            "critic_points": points,
            "ta_message": ta_message,
        }
    else:
        # インタラクティブモード: 最初のステップ（レポート生成）のみ実行
        report_text = reporter.report(request.user_topic)
        return {
            "status": "awaiting_report_feedback",
            "report": report_text,
        }


@app.post("/submit_report_feedback")
def submit_report_feedback(response: ReporterResponse):
    # レポートへのフィードバックを受け取り、critic pointsを生成
    points = critic.extract_points(response.report_text)
    return {
        "status": "awaiting_critic_feedback",
        "points": points,
    }


@app.post("/submit_critic_feedback")
def submit_critic_feedback(response: CriticResponse):
    # Critic pointsへのフィードバックを受け取り、TAの応答を生成
    ta_message = ta.facilitate_discussion("", response.points)
    return {
        "status": "completed",
        "ta_message": ta_message,
    }


@app.get("/news_suggestions")
def get_news_suggestions():
    """ニュースの提案を取得するエンドポイント"""
    news_items = ta.get_news_suggestions()
    return {"news_items": news_items}
