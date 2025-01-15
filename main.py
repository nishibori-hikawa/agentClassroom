# main.py
from fastapi import FastAPI
from pydantic import BaseModel
from writer_agent import WriterAgent
from dotenv import load_dotenv
import os
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

app = FastAPI()
writer = WriterAgent()

class TopicRequest(BaseModel):
    topic: str


@app.get("/")
def read_root():
    return {"message": "AgentClassroom2 APIへようこそ！"}

@app.post("/ask")
def ask(request: TopicRequest):
    blog_text = writer.write(request.topic)
    return {"topic": request.topic, "blog": blog_text}