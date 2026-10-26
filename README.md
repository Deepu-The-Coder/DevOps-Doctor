# DevOpsDoctor

Reads a GitHub repo and its deployment logs together and returns a ranked differential
diagnosis with file:line and log-line evidence. Probe Mode runs safe read-only checks
and re-ranks. Runs on Gemma (Google AI Studio by default).

## Run locally

Backend:
```
cd backend
npm install
cp .env.example .env      # set MODEL_ACCESS_KEY and MODEL_ID (npm run models lists Gemma ids)
npm run dev               # http://localhost:8787
```
No key yet? Set `LLM_MOCK=1` in `.env` to click through the UI with placeholder output.

Frontend (proxies /api to :8787):
```
cd frontend
npm install
npm run dev               # http://localhost:5173/app?case=case-c
```

Docs: [docs/PRD.md](docs/PRD.md), [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md).

## Sign in with GitHub (optional)
Lets users pick from their own repos, including private ones. The OAuth token stays in a
server-side session (httpOnly cookie); it is used only for GitHub reads and never sent to the model.

1. https://github.com/settings/developers → New OAuth App
   - Homepage URL: `http://localhost:5173`
   - Callback URL: `http://localhost:5173/api/auth/github/callback`
2. Put the Client ID and a new Client Secret in `backend/.env` as `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
3. Restart the backend. A "Sign in" button appears in the top bar.
