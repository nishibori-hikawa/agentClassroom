import json

import requests
from pydantic import BaseModel

from graph import HumanSelection, State


class GraphRequest(BaseModel):
    first_call: bool
    state: State
    thread_id: int


# サーバーのURL
url = "http://localhost:8000/stream"

# 初期状態を設定
initial_state = State(query="トランプの経済政策")
request_data = GraphRequest(first_call=True, state=initial_state, thread_id=1)

# 初期状態でリクエストを送信
response = requests.post(url, json=request_data.model_dump(), stream=True)

print("Initial response:")
res_state = None
try:
    event_type = None
    data = None
    for line in response.iter_lines():
        if line:
            decoded_line = line.decode("utf-8")
            try:
                state = State(**json.loads(decoded_line))
                res_state = state
                # print(state.reporter_content)
                # print(state.critic_content)
            except Exception as e:
                print(f"Error: {e}")


except requests.exceptions.ChunkedEncodingError as e:
    print(f"Error: {e}")

# 状態を更新して再度リクエストを送信

if res_state:
    updated_state = res_state
    updated_state.human_selection = HumanSelection(point_num=1, case_num=1)
    print("Updated state:", updated_state)
    request_data = GraphRequest(first_call=False, state=updated_state, thread_id=1)

    response = requests.post(url, json=request_data.model_dump(), stream=True)

    print("Updated response:")
    try:
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode("utf-8")
                try:
                    state = State(**json.loads(decoded_line))
                    print(state)
                except Exception as e:
                    print(f"Error: {e}")
            res_state = state
    except requests.exceptions.ChunkedEncodingError as e:
        print(f"Error: {e}")
