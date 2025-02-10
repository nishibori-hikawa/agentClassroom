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
cd backend
poetry run uvicorn server:app --reload
```

Agent Classroomのフロントエンドを起動するには以下のコマンドを実行してください。
```bash
cd frontend
npm run dev
```

## cloud run
せっていs
### プロジェクトIDとリージョンの設定

```bash
gcloud config set project third-pen-445109-g1
gcloud config set run/region asia-northeast1
```

### デプロイ

```bash
gcloud run deploy agent-classroom --source . --port 8080 --region asia-northeast1
```

### ビルドログの確認
```bash
gcloud builds list --limit=1 --format="get(id)" | xargs -I {} gcloud builds log {} | cat
```
