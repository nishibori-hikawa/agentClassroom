# main.py
from fastapi import FastAPI
from pydantic import BaseModel
from writer_agent import WriterAgent
from reporter_agent import ReporterAgent
from critic_agent import CriticAgent
from dotenv import load_dotenv
import os
from ta_agent import TeachingAssistantAgent
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

app = FastAPI()
writer = WriterAgent()
reporter = ReporterAgent()
critic = CriticAgent()
ta = TeachingAssistantAgent()

conversation_log = []

class TopicRequest(BaseModel):
    topic: str

class CriticRequest(BaseModel):
    report_text: str

class TARequest(BaseModel):
    report_text: str
    points: list[str]
    additional_note: str = ""

class ChainRequest(BaseModel):
    topic: str
    additional_note: str = ""

class UserSpeakRequest(BaseModel):
    content: str

@app.get("/")
def read_root():
    return {"message": "AgentClassroom2 APIへようこそ！"}

@app.post("/ask")
def ask(request: TopicRequest):
    blog_text = writer.write(request.topic)
    return {"topic": request.topic, "blog": blog_text}

@app.post("/report")
def report(request: TopicRequest):
    report_text = reporter.report(request.topic)
    return {"topic": request.topic, "report": report_text}

@app.post("/critic")
def critic_endpoint(request: CriticRequest):
    points = critic.extract_points(request.report_text)
    return {"points": points}

@app.post("/ta")
def ta_endpoint(request: TARequest):
    ta_message = ta.facilitate_discussion(
        request.report_text, 
        request.points, 
        request.additional_note
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
        "ta_message": ta_message
    }

@app.post("/user_speak")
def user_speak(request: UserSpeakRequest):
    conversation_log.append({"role": "user", "content": request.content})
    # For now, we just call TA with the latest user content.
    # More advanced logic (involving Reporter or Critic) can be added later.
    ta_reply = ta.facilitate_discussion(
        report_text=request.content,
        points=[],
        additional_note="ユーザーからの質問です。"
    )
    conversation_log.append({"role": "ta", "content": ta_reply})
    return {"ta_reply": ta_reply}