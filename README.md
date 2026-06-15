# WES AI Demo

Monorepo for the Honeywell Intelligrated WES operations demo: synthetic warehouse data, Express API, Next.js dashboard, and OpenAI agent chat.

## Structure

| Folder | Purpose |
|--------|---------|
| `wes-demo-app/` | Next.js frontend (dashboard + agent chat) |
| `Wes-demo-express-server/` | Express API, MongoDB access, OpenAI streaming |

## Local development

**Prerequisites:** Node.js 20+, MongoDB running locally, OpenAI API key.

```bash
# Terminal 1 — API
cd Wes-demo-express-server
cp .env.example .env   # fill in OPENAI_API_KEY
npm install
npm run seed           # first time only
npm run dev

# Terminal 2 — Frontend
cd wes-demo-app
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Deploy to Vercel (two projects, one repo)

Import this repo twice in [Vercel](https://vercel.com/new), each with a different **Root Directory**.

### 1. Backend — `Wes-demo-express-server`

| Setting | Value |
|---------|-------|
| Root Directory | `Wes-demo-express-server` |
| Framework | Other |
| Build Command | *(leave empty)* |
| Install Command | `npm install` |

**Environment variables:**

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB` | `wes_demo` |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | e.g. `gpt-4o-mini` |
| `FRONTEND_ORIGIN` | Frontend Vercel URL (for CORS) |

Seed Atlas once from your machine:

```bash
cd Wes-demo-express-server
MONGODB_URI="mongodb+srv://..." npm run seed
```

Verify: `GET https://<backend-url>/api/health`

### 2. Frontend — `wes-demo-app`

| Setting | Value |
|---------|-------|
| Root Directory | `wes-demo-app` |
| Framework | Next.js |

**Environment variables:**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend Vercel URL |

After both deploy, update `FRONTEND_ORIGIN` on the backend to match the frontend URL.

## GitHub

[github.com/jibranas/agentic-wes](https://github.com/jibranas/agentic-wes)
