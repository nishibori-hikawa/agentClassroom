from langserve import RemoteRunnable

# openai = RemoteRunnable("http://localhost:8080/openai")
graph = RemoteRunnable("http://localhost:8080/graph")

# openai.invoke({"query": "What is the capital of Japan?"})

for chuck in graph.stream({"query": "What is the capital of Japan?"}, None):
    print(chuck)
