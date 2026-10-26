# BUILD_SPEC — DevOpsDoctor (technical)

Written during the build because the original spec was not available. Describes what
exists in the repo. docs/PRD.md wins on any conflict.

## Layout
```
backend/      Express API (Node >= 20.6, no build step)
frontend/     Vite + React + react-router-dom
sample-app/   4 copies of a broken Node/Express/Postgres app (case-a..d)
frontend/public/cases/case-*.log   deploy logs for each case
design/       Stitch export (workspace screen)
```

## Sample cases
Every case fails the same way at app level: `FATAL could not connect to database after 5
retries`, then the container fails its health check. Each case is deployed with
Docker Compose (`docker-compose.yml` + `Dockerfile`). The causes differ:

| Case   | Category   | Planted bug |
|--------|------------|-------------|
| case-a | env        | code reads `DB_URL` (src/config.js), docker-compose.yml sets `DATABASE_URL` |
| case-b | platform   | `DATABASE_URL` is only a build arg (compose `build.args` + Dockerfile `ARG`), so it is missing at runtime |
| case-c | config     | docker-compose.yml hard-codes an unreachable old DB IP (`203.0.113.24:5432`) instead of the `db` service |
| case-d | dependency | `pg@7.4.3` on Node 20 (pg < 8 breaks on Node >= 14) |

The "Reveal answer" text in frontend/src/data/cases.js is left for the team to write.

## API (backend/src/server.js)
- `POST /api/ingest {repoUrl, branch}` → `{repo, sha, files:[{path, content, lines}], skipped, redactions, time_ms}`
  repoUrl may be `https://github.com/o/r` or `.../tree/<branch>/<subpath>`.
- `POST /api/diagnose {repoUrl, branch, logs, mode: "full"|"logs-only"}` → `{diagnosis, meta}`
- `POST /api/probe {repoUrl, branch, logs, hypotheses}` → NDJSON stream of events:
  `start`, `round`, `probe_start`, `probe_result`, `rerank {hypotheses, changes}`, `error`, `done`.
- `GET /api/health` → `{ok, model, mock}`

## Case file
- Repo: one GitHub tree API call, contents via raw.githubusercontent.com. Up to 40 text
  files / 120 KB, ranked: deploy config (compose, fly, render, k8s…) > Dockerfile > manifests > .env examples > config > src.
  Real `.env` files are never read into the case. Ingest cached 10 min in memory.
- Logs: kept with original line numbers; if > 400 lines, signal lines + last 150.
- Secrets are masked in place (URL passwords, *_SECRET/TOKEN/PASSWORD/KEY values, GitHub/
  AWS/sk- tokens, private keys) before anything goes to the model or the browser.

## Diagnosis JSON (model output, after normalisation)
```
{ summary, hypotheses: [ { id, title, category, confidence 0..1, reasoning,
  evidence: [ {type:"file", path, line, text} | {type:"log", line, text} ],
  dropped_evidence: [ {ref, reason} ], rule_out, patch: {path, diff, verified} | null } ] }
```
Categories: network, env, config, code, platform, dependency. 3–5 hypotheses, sorted.

## Evidence verification
Each ref is checked against the actual case file. If the line number is wrong but the
quote matches another line, the ref is corrected. Refs to files/lines that don't exist
are dropped and listed in `dropped_evidence` (shown in the UI). Patches whose path is not
in the repo are kept but flagged `verified: false`.

## Probe Mode
Tools (read-only, allowlisted): `dns_lookup`, `tcp_connect`, `http_get` (no redirects,
300 bytes), `read_file` (repo only). Max 3 rounds, 4 probes per round, 4 s timeout each.
Network probes only reach hosts/IPs that literally appear in the repo files or logs, and
never private, loopback, link-local, CGNAT or multicast addresses (checked after DNS
resolution too). No shell commands are ever executed.

## Model
Gemma via any OpenAI-compatible API (default: Google AI Studio,
`https://generativelanguage.googleapis.com/v1beta/openai`).
`POST {MODEL_BASE_URL}/chat/completions`, `Authorization: Bearer MODEL_ACCESS_KEY`. System
prompts are folded into the first user message for Gemma models.
`npm run models` lists ids available to the key. temperature 0.1, JSON-only prompt,
JSON extracted from fences/prose if needed.

## Fallbacks
- Last good diagnosis per (repo, mode, logs) is written to backend/.cache/. If the model
  call fails (5xx/timeout), the cached result is returned with `meta.cached = true` and
  the UI shows a banner.
- `LLM_MOCK=1` returns labelled placeholder output for UI testing only.

## Not built yet
Overview page and deploy config.

## Eval
`node scripts/eval.js` (backend must be running) runs every case in eval/expected.json in
three modes: `full`, `logs-only`, `full+probe`. A hypothesis is correct when its title +
reasoning match the case's `match` regex. Writes `frontend/public/eval-results.json` (read by
/benchmarks) and a timestamped copy in `eval/results/`. Options: `--modes`, `--cases`, `--api`.
