import requests
from pydantic import BaseModel

from graph import HumanSelection, State


class GraphRequest(BaseModel):
    first_call: bool
    state: State
    thread_id: int


# サーバーのURL
url = "http://localhost:8080/graph"

# 初期状態を設定
initial_state = State(query="トランプの経済政策について")
request_data = GraphRequest(first_call=True, state=initial_state, thread_id=1)

# 初期状態でリクエストを送信
response = requests.post(url, json=request_data.model_dump())
print("Initial response:")
print(response.json())

# 状態を更新して再度リクエストを送信
updated_state = State(**response.json())
updated_state.human_selection = HumanSelection(point_num=1, case_num=1)
print("frontend/client.py")
print("Updated state:", updated_state)
request_data = GraphRequest(first_call=False, state=updated_state, thread_id=1)

response = requests.post(url, json=request_data.model_dump())
print("Updated response:")
print(response.json())
