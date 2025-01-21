from dotenv import load_dotenv
from langchain.schema.runnable import Runnable
from langchain_chroma import Chroma
from langchain_community.vectorstores.utils import filter_complex_metadata
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import CharacterTextSplitter
from langchain_unstructured import UnstructuredLoader

load_dotenv()

# RAGに追加するPDFファイルを指定
loader = UnstructuredLoader(
    file_path="./documents/SPGP-SAEA.pdf",
)

raw_docs = loader.load()

text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)

docs = text_splitter.split_documents(raw_docs)

filtered_docs = filter_complex_metadata(docs)

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

db = Chroma.from_documents(filtered_docs, embeddings)

retreiver = db.as_retriever()

template = '''
 以下の文脈だけを踏まえて質問に回答してください。

 文脈: """
 {context}
 """
 質問: {question}
'''

prompt = PromptTemplate(template=template, input_variables=["context", "question"])

model = ChatOpenAI(model="gpt-4o-mini", temperature=0)

chain: Runnable = (
    {"context": retreiver, "question": RunnablePassthrough()}
    | prompt
    | model
    | StrOutputParser()
)

# RAGへの質問
query = "What is SPGP-SAEA?"

output = chain.invoke(query)
print(output)
