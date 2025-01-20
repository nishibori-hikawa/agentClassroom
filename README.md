# agentClassroom

## Pythonのバージョン
3.11.3

## Poetryのバージョン
2.0.1

## 環境変数の設定

### .envファイル

```bash
OPENAI_API_KEY=your_openai_api_key
```

### .env.localファイル

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## 実行方法

Agent Classroomのバックエンドを起動するには以下のコマンドを実行してください。
```bash
poetry run uvicorn main:app --reload
```

Agent Classroomのフロントエンドを起動するには以下のコマンドを実行してください。
```bash
cd my-ai-classroom
npm run dev
```
