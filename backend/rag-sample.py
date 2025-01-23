from dotenv import load_dotenv
from langchain.schema.runnable import Runnable
from langchain_chroma import Chroma
from langchain_community.retrievers import TavilySearchAPIRetriever
from langchain_community.vectorstores.utils import Document, filter_complex_metadata
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.retrievers import BaseRetriever
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import CharacterTextSplitter

from utils.pdf_loader import extract_text_from_pdf

load_dotenv()


# PDFファイルを読み込んで、Documentオブジェクトのリストに変換する
def pdf_to_documents(file_path: str) -> list[Document]:
    text = extract_text_from_pdf(file_path)
    docs = Document(page_content=text)
    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
    split_docs = text_splitter.split_documents([docs])
    return filter_complex_metadata(split_docs)


retriever_type = "pdf"
retriever: BaseRetriever
if retriever_type == "tavily":
    retriever = TavilySearchAPIRetriever(k=3)
else:
    if True:
        file_path = "./documents/main.pdf"
        filtered_docs = pdf_to_documents(file_path)
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        db = Chroma.from_documents(filtered_docs, embeddings)
    retriever = db.as_retriever()

template = '''
 以下の資料だけを踏まえて質問に回答してください。

 資料: """
 {context}
 """
 質問: {question}
'''

prompt = PromptTemplate(template=template, input_variables=["context", "question"])
model = ChatOpenAI(model="gpt-4o-mini", temperature=0)

chain: Runnable = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | model
    | StrOutputParser()
)

# RAGへの質問
query = "筆者の主張を教えてください。"

output = chain.invoke(query)
print(output)
