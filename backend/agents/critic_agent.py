from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

from agents.prompt_writer import CRITIC_PROMPT_TEMPLATE


class CriticAgent:
    def __init__(self, model_name="gpt-4o-mini", temperature=0.7):
        self.llm = ChatOpenAI(model_name=model_name, temperature=temperature)

    def extract_points(self, report_text: str) -> list[str]:
        prompt = PromptTemplate(
            template=CRITIC_PROMPT_TEMPLATE,
            input_variables=["report_text"],
        )
        final_prompt = prompt.format(report_text=report_text)
        return self.llm.predict(final_prompt).split("\n")
