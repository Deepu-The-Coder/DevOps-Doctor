import { chatJSON } from './model.js';
import { renderCaseFile } from './caseFile.js';

export const CATEGORIES = ['network', 'env', 'config', 'code', 'platform', 'dependency'];

export const DIAGNOSIS_SCHEMA = `{
  "summary": "one sentence: what failed and the most likely reason",
  "hypotheses": [
    {
      "id": "h1",
      "title": "short root-cause statement",
      "category": "network | env | config | code | platform | dependency",
      "confidence": 0.0,
      "reasoning": "2-3 sentences linking the evidence",
      "evidence": [
        { "type": "file", "path": "src/config.js", "line": 4, "quote": "exact text from that line" },
        { "type": "log", "line": 11, "quote": "exact text from that log line" }
      ],
      "rule_out": "a concrete check that would eliminate this hypothesis",
      "patch": { "path": "src/config.js", "diff": "unified diff" }
    }
  ]
}`;

const SYSTEM = `You are DevOpsDoctor, a diagnostician for failed deployments.
You receive a case file: repository files with line numbers ("12| code") and deployment
logs with line numbers ("L12| text"). Produce a differential diagnosis.

Rules:
- Return ONLY a JSON object matching the schema. No prose outside JSON.
- 3 to 5 hypotheses, sorted by confidence (0..1, independent, need not sum to 1).
- Look specifically for mismatches between code and platform config: env var names the
  code reads vs names the platform sets, build-time-only vars (build args) vs runtime env, ports,
  hosts, runtime/engine versions vs dependency versions, Dockerfile vs compose/deploy config.
- Every hypothesis needs at least one evidence item. A file ref must use a path and line
  number that appear in the case file. A log ref uses the number after "L". Copy the quote
  exactly from that line. Never invent files or lines.
- rule_out: one concrete check (a command, a setting to look at, or a probe).
- patch: a minimal unified diff (---/+++/@@ with -/+ lines) against a file in the case
  file, or null if no code/config change would fix it.
- category is one of: ${CATEGORIES.join(', ')}.

Schema:
${DIAGNOSIS_SCHEMA}`;

export async function runDiagnosis({ files, logs, mode }) {
  const caseFile = renderCaseFile({ files, logs, mode });
  const { json, usage } = await chatJSON([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: caseFile },
  ]);
  return { diagnosis: normalizeDiagnosis(json, { files: mode === 'logs-only' ? [] : files, logs }), usage };
}

// Clean up model output and verify every evidence ref against the real case file.
// Refs that don't exist are dropped and recorded so the UI can flag them.
export function normalizeDiagnosis(raw, { files, logs }) {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const list = Array.isArray(raw?.hypotheses) ? raw.hypotheses : [];
  const hypotheses = list
    .filter((h) => h && typeof h === 'object' && h.title)
    .map((h, i) => {
      const dropped = [];
      const evidence = [];
      for (const ev of Array.isArray(h.evidence) ? h.evidence : []) {
        const v = verifyEvidence(ev, byPath, logs);
        if (v.ok) evidence.push(v.ev);
        else dropped.push({ ref: describeRef(ev), reason: v.reason });
      }
      let patch = null;
      if (h.patch && typeof h.patch === 'object' && h.patch.diff) {
        const p = cleanPath(h.patch.path);
        patch = { path: p, diff: String(h.patch.diff), verified: byPath.has(p) };
      }
      const category = String(h.category || '').toLowerCase();
      return {
        id: String(h.id || `h${i + 1}`),
        title: String(h.title).slice(0, 200),
        category: CATEGORIES.includes(category) ? category : 'config',
        confidence: clamp01(Number(h.confidence)),
        reasoning: h.reasoning ? String(h.reasoning) : '',
        evidence,
        dropped_evidence: dropped,
        rule_out: h.rule_out ? String(h.rule_out) : '',
        patch,
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  // Ids must be unique for probe re-ranking to track changes.
  const seen = new Set();
  for (const [i, h] of hypotheses.entries()) {
    if (seen.has(h.id)) h.id = `h${i + 1}_${i}`;
    seen.add(h.id);
  }
  return { summary: raw?.summary ? String(raw.summary) : '', hypotheses };
}

function verifyEvidence(ev, byPath, logs) {
  if (!ev || typeof ev !== 'object') return { ok: false, reason: 'malformed' };
  const quote = ev.quote ? String(ev.quote).trim() : '';
  if (ev.type === 'log') {
    let line = parseInt(ev.line, 10);
    if (!(line >= 1 && line <= logs.all.length) && quote) line = findLine(logs.all, quote);
    if (!(line >= 1 && line <= logs.all.length)) return { ok: false, reason: 'log line does not exist' };
    if (quote && !looseIncludes(logs.all[line - 1], quote)) {
      const found = findLine(logs.all, quote);
      if (found) line = found;
    }
    return { ok: true, ev: { type: 'log', line, text: logs.all[line - 1] } };
  }
  const path = cleanPath(ev.path);
  const f = byPath.get(path);
  if (!f) return { ok: false, reason: 'file not in repo context' };
  let line = parseInt(ev.line, 10);
  if (quote && (!(line >= 1 && line <= f.lines.length) || !looseIncludes(f.lines[line - 1], quote))) {
    const found = findLine(f.lines, quote);
    if (found) line = found;
  }
  if (!(line >= 1 && line <= f.lines.length)) return { ok: false, reason: 'line out of range' };
  return { ok: true, ev: { type: 'file', path, line, text: f.lines[line - 1] } };
}

function findLine(lines, quote) {
  const q = norm(quote);
  if (!q) return 0;
  const idx = lines.findIndex((l) => norm(l).includes(q));
  return idx >= 0 ? idx + 1 : 0;
}
const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
const looseIncludes = (line, quote) => norm(line).includes(norm(quote));
const cleanPath = (p) => String(p || '').replace(/^\.?\/+/, '').trim();
const clamp01 = (n) => (Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0, n > 1 && n <= 100 ? n / 100 : n)) * 100) / 100 : 0);
const describeRef = (ev) => (ev?.type === 'log' ? `log L${ev?.line}` : `${ev?.path}:${ev?.line}`);

// ---- Dev-only mock, used when LLM_MOCK=1. Clearly labelled in the UI.
export function mockDiagnosis({ files, logs, mode }) {
  const fatal = logs.all.findIndex((l) => /fatal|error/i.test(l)) + 1 || 1;
  const cfg = files.find((f) => /config|app\.ya?ml/.test(f.path)) || files[0];
  const raw = {
    summary: 'MOCK OUTPUT (LLM_MOCK=1): placeholder diagnosis for UI testing, not a real model result.',
    hypotheses: [
      { id: 'h1', title: 'Mock: database connection settings wrong at runtime', category: 'env', confidence: 0.62, reasoning: 'Mock.', evidence: [{ type: 'log', line: fatal }, ...(mode !== 'logs-only' && cfg ? [{ type: 'file', path: cfg.path, line: 1 }] : [])], rule_out: 'Mock: print the env at startup.', patch: cfg && mode !== 'logs-only' ? { path: cfg.path, diff: `--- a/${cfg.path}\n+++ b/${cfg.path}\n@@ -1,1 +1,1 @@\n-${cfg.lines[0]}\n+${cfg.lines[0]} // mock change` } : null },
      { id: 'h2', title: 'Mock: database host unreachable from app', category: 'network', confidence: 0.41, reasoning: 'Mock.', evidence: [{ type: 'log', line: fatal }], rule_out: 'Mock: tcp_connect to the DB host.', patch: null },
      { id: 'h3', title: 'Mock: driver incompatible with runtime', category: 'dependency', confidence: 0.18, reasoning: 'Mock.', evidence: [{ type: 'log', line: fatal }, { type: 'file', path: 'does/not/exist.js', line: 3 }], rule_out: 'Mock: check engines.', patch: null },
    ],
  };
  return normalizeDiagnosis(raw, { files: mode === 'logs-only' ? [] : files, logs });
}
