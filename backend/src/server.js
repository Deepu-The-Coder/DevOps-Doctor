import express from 'express';
import cors from 'cors';
import { ingestRepo, httpError } from './github.js';
import { prepareFiles, prepareLogs, mentionedHosts } from './caseFile.js';
import { runDiagnosis, mockDiagnosis } from './diagnose.js';
import { runProbeLoop } from './probes.js';
import { modelInfo } from './model.js';
import { cacheKey, readCache, writeCache } from './cache.js';

const app = express();
const origins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));
app.use(express.json({ limit: '2mb' }));

const MAX_LOG_CHARS = 500_000;

app.get('/api/health', (req, res) => res.json({ ok: true, ...modelInfo() }));

// 1. Ingest: read the repo and return the (redacted) files the model will see.
app.post('/api/ingest', async (req, res, next) => {
  try {
    const t0 = Date.now();
    const ingest = await ingestRepo(req.body.repoUrl, req.body.branch);
    const { files, redactions } = prepareFiles(ingest.files);
    res.json({
      repo: ingest.repo,
      sha: ingest.sha,
      files: files.map((f) => ({ path: f.path, content: f.content, lines: f.lines.length })),
      skipped: ingest.skipped,
      redactions,
      time_ms: Date.now() - t0,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Diagnose: repo + logs -> ranked hypotheses with verified evidence.
app.post('/api/diagnose', async (req, res, next) => {
  const t0 = Date.now();
  const mode = req.body.mode === 'logs-only' ? 'logs-only' : 'full';
  let key = null;
  try {
    const logsRaw = String(req.body.logs || '');
    if (!logsRaw.trim()) throw httpError(400, 'logs are required');
    if (logsRaw.length > MAX_LOG_CHARS) throw httpError(413, 'logs too large (max 500 KB)');

    const ingest = await ingestRepo(req.body.repoUrl, req.body.branch);
    key = cacheKey({ repo: ingest.repo, logs: logsRaw, mode });
    const { files, redactions: fr } = prepareFiles(ingest.files);
    const logs = prepareLogs(logsRaw);
    const { model, mock } = modelInfo();

    const result = mock ? { diagnosis: mockDiagnosis({ files, logs, mode }), usage: null } : await runDiagnosis({ files, logs, mode });
    const payload = {
      diagnosis: result.diagnosis,
      meta: {
        model,
        mock,
        mode,
        cached: false,
        time_ms: Date.now() - t0,
        files_sent: mode === 'logs-only' ? 0 : files.length,
        log_lines: logs.all.length,
        redactions: fr + logs.redactions,
        usage: result.usage,
        generated_at: new Date().toISOString(),
      },
    };
    if (!mock) writeCache(key, payload);
    res.json(payload);
  } catch (err) {
    // Model or network failure: fall back to the last good run for the same inputs.
    const cached = key && readCache(key);
    if (cached && (err.status || 500) >= 500) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true, cache_reason: err.message, time_ms: Date.now() - t0 } });
    }
    next(err);
  }
});

// 3. Probe: stream the probe loop as NDJSON so the UI can show it live.
app.post('/api/probe', async (req, res, next) => {
  let streaming = false;
  try {
    const logsRaw = String(req.body.logs || '');
    const hypotheses = Array.isArray(req.body.hypotheses) ? req.body.hypotheses : [];
    if (!logsRaw.trim()) throw httpError(400, 'logs are required');
    if (!hypotheses.length) throw httpError(400, 'run a diagnosis first');

    const ingest = await ingestRepo(req.body.repoUrl, req.body.branch);
    const { files } = prepareFiles(ingest.files);
    const logs = prepareLogs(logsRaw);
    const hosts = mentionedHosts(files, logs.all);

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    streaming = true;
    const emit = (ev) => res.write(JSON.stringify(ev) + '\n');
    try {
      await runProbeLoop({ ingest, files, logs, hypotheses, hosts, emit, mock: modelInfo().mock });
    } catch (err) {
      emit({ type: 'error', message: err.message });
    }
    res.end();
  } catch (err) {
    if (streaming) return res.end();
    next(err);
  }
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'internal error' });
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`devopsdoctor backend on :${port} (model: ${modelInfo().model})`));
