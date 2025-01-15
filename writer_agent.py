# writer_agent.py

from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

# とりあえずOpenAI例。Google Cloudなら PaLMモデルに差し替え可

from prompt_writer import WRITER_PROMPT_TEMPLATE

class WriterAgent:
    def __init__(self, model_name="gpt-4o-mini", temperature=0.7):
        self.llm = ChatOpenAI(model_name=model_name, temperature=temperature)

    def write(self, topic: str) -> str:
        prompt = PromptTemplate(
            template=WRITER_PROMPT_TEMPLATE,
            input_variables=["topic"]
        )
        final_prompt = prompt.format(topic=topic)
        return self.llm.predict(final_prompt)