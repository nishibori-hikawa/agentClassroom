import pdfplumber
from langchain_community.vectorstores.utils import Document, filter_complex_metadata
from langchain_text_splitters import CharacterTextSplitter


def extract_text_from_pdf(pdf_path: str) -> str:
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text()
    return text


def text_to_documents(text: str) -> list[Document]:
    docs = Document(page_content=text)
    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
    split_docs = text_splitter.split_documents([docs])
    return filter_complex_metadata(split_docs)
