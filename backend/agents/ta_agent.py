import random

import feedparser
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

TA_PROMPT_TEMPLATE = """
あなたはTA（Teaching Assistant）です。以下を参考に議論を進めるためのコメントを返してください。
報告文: {report_text}
抽出された論点:
{formatted_points}

{additional_instructions}
"""  # noqa: RUF001


class TeachingAssistantAgent:
    def __init__(self, model_name="gpt-4o-mini", temperature=0.7):
        self.llm = ChatOpenAI(model_name=model_name, temperature=temperature)
        self.user_feedback = []
        self.news_feed_url = "http://feeds.cnn.co.jp/rss/cnn/cnn.rdf"

    def get_news_suggestions(self) -> list[dict]:
        """CNNニュースフィードから最新の5つのニュースを取得"""
        feed = feedparser.parse(self.news_feed_url)
        news_items = []

        for entry in feed.entries[:5]:  # 最新5件を取得
            news_items.append(
                {"title": entry.title, "description": entry.description, "link": entry.link},
            )

        return news_items

    def facilitate_discussion(
        self,
        report_text: str,
        points: list[str],
        additional_note: str = "",
    ) -> str:
        formatted_points = "\n".join(f"- {p}" for p in points)
        prompt = PromptTemplate(
            template=TA_PROMPT_TEMPLATE,
            input_variables=[
                "report_text",
                "formatted_points",
                "additional_instructions",
            ],
        ).format(
            report_text=report_text,
            formatted_points=formatted_points,
            additional_instructions=additional_note or "",
        )
        return self.llm.predict(prompt)

    def add_user_feedback(self, feedback: str):
        self.user_feedback.append(feedback)

    def get_user_feedback(self) -> list[str]:
        return self.user_feedback
