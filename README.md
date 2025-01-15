# agentClassroom

## 環境変数の設定（.envファイル）

```bash
OPENAI_API_KEY=your_openai_api_key
```

## 実行方法
```bash
poetry run uvicorn main:app --reload
```

## 別のターミナルで
```bash
curl -X POST "http://127.0.0.1:8000/ask" -H "Content-Type: application/json" -d '{"topic": "ブロック チェーン"}'
```
