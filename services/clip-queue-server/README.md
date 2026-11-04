# Clip Queue Server (Vercel Cloud Microservice)

Lightweight, serverless Video Link Ingestion & Google Drive Queue API. Connects your mobile phone share sheet to VideoTimmer on your Mac via MongoDB Atlas.

## Environment Variables

Configure in your Vercel Project Settings or local `.env`:

```env
MONGODB_URI="mongodb+srv://<user>:<password>@cluster0.3hnqz7n.mongodb.net/jobs?retryWrites=true&w=majority&appName=Cluster0"
```

## API Endpoints

- `POST /api/queue`: Enqueue a video URL with destination Google Drive folder
- `GET /api/queue`: List queued items with filtering (`?status=pending|completed`)
- `GET /api/queue/:id`: Inspect single item status
- `PATCH /api/queue/:id`: Update status/progress (called by VideoTimmer Mac worker)
- `DELETE /api/queue/:id`: Remove item
- `GET /api/folders`: List available Google Drive folders for mobile app picker
- `POST /api/folders/sync`: Sync folder list from Mac
- `GET /api/health`: Health status check

## Deploy to Vercel

1. Push this directory or repository to GitHub.
2. In Vercel, click **Add New Project** and select this repo.
3. If deployed from a monorepo, set **Root Directory** to `services/clip-queue-server`.
4. Add the `MONGODB_URI` environment variable.
5. Deploy.

