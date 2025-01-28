from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

from agents.prompt_writer import CRITIC_PROMPT_TEMPLATE
import requests


class CriticAgent:
    def __init__(self, model_name="gpt-4o-mini", temperature=0.7):
        self.llm = ChatOpenAI(model_name=model_name, temperature=temperature)

    def call_fact_checking_api(self, text: str) -> dict:
        # Placeholder for actual API call
        response = requests.post("https://factcheckapi.example.com/check", json={"text": text})
        return response.json()

    def extract_points(self, report_text: str) -> list[str]:
        prompt = PromptTemplate(
            template=CRITIC_PROMPT_TEMPLATE,
            input_variables=["report_text"],
        )
        final_prompt = prompt.format(report_text=report_text)
        points = self.llm.predict(final_prompt).split("\n")

        # Call fact-checking API and include results in points
        fact_check_results = self.call_fact_checking_api(report_text)
        points.append(f"Fact-check results: {fact_check_results}")

        return points
