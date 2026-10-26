#!/usr/bin/env node
// Runs every case in eval/expected.json through the running backend in three modes
// (full, logs-only, full+probe), scores the ranking, and writes:
//   eval/results/<timestamp>.json
//   frontend/public/eval-results.json   (read by the Benchmarks page)
//
// Usage: node scripts/eval.js [--api http://localhost:8787] [--modes full,logs-only,full+probe] [--cases case-a,case-c]
//        node scripts/eval.js --retry-errors   (re-run only errored cases in the last results, merge)
//
// Scoring
//   correct hypothesis: title + reasoning match the case's `match` regex
//   top1_correct:       hypothesis #1 is correct
//   top1_accuracy:      correct / completed runs; provider errors are excluded and counted in `errors`
//   correct_rank:       rank of the first correct hypothesis (null if none)
//   false_positives:    incorrect hypotheses with confidence >= 0.5
//   time_ms:            wall time for the run (diagnose, plus the probe loop in full+probe)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const API = arg('api', process.env.EVAL_API || 'http://localhost:8787').replace(/\/+$/, '');
const MODES = arg('modes', 'full,logs-only,full+probe').split(',');
const ONLY = arg('cases', '') ? arg('cases').split(',') : null;
const FP_THRESHOLD = 0.5;

const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'eval/expected.json'), 'utf8')).cases.filter(
  (c) => !ONLY || ONLY.includes(c.case)
);

// Retries once if the backend connection drops (e.g. it restarted).
async function post(p, body) {
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  try {
    return await fetch(API + p, opts);
  } catch {
    await new Promise((r) => setTimeout(r, 3000));
    return fetch(API + p, opts);
  }
}

async function diagnose(c, logs, mode) {
  const res = await post('/api/diagnose', { repoUrl: c.repoUrl, branch: c.branch, logs, mode });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function probe(c, logs, hypotheses) {
  const res = await post('/api/probe', { repoUrl: c.repoUrl, branch: c.branch, logs, hypotheses });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  const text = await res.text();
  let final = hypotheses;
  let rounds = 0;
  for (const line of text.split('\n').filter(Boolean)) {
    const ev = JSON.parse(line);
    if (ev.type === 'done') {
      final = ev.hypotheses;
      rounds = ev.rounds;
    }
    if (ev.type === 'error') throw new Error(ev.message);
  }
  return { hypotheses: final, rounds };
}

function score(c, hypotheses) {
  const re = new RegExp(c.match, 'i');
  const correct = hypotheses.map((h) => re.test(`${h.title}\n${h.reasoning || ''}`));
  const idx = correct.indexOf(true);
  return {
    top1_correct: correct[0] === true,
    correct_rank: idx >= 0 ? idx + 1 : null,
    false_positives: hypotheses.filter((h, i) => !correct[i] && h.confidence >= FP_THRESHOLD).length,
    top1_title: hypotheses[0]?.title || null,
  };
}

const RETRY = process.argv.includes('--retry-errors');

async function runCase(c, mode) {
  const logs = fs.readFileSync(path.join(ROOT, c.log), 'utf8');
  const t0 = Date.now();
  process.stdout.write(`${mode.padEnd(10)} ${c.case} … `);
  try {
    const d = await diagnose(c, logs, mode === 'logs-only' ? 'logs-only' : 'full');
    let hyps = d.diagnosis.hypotheses;
    let rounds = 0;
    if (mode === 'full+probe') ({ hypotheses: hyps, rounds } = await probe(c, logs, hyps));
    const s = score(c, hyps);
    const row = {
      case: c.case,
      ...s,
      time_ms: Date.now() - t0,
      cached: !!d.meta.cached,
      model: d.meta.model,
      hypotheses: hyps.map(({ title, category, confidence, reasoning }) => ({ title, category, confidence, reasoning })),
      ...(mode === 'full+probe' ? { probe_rounds: rounds } : {}),
    };
    console.log(`top1=${s.top1_correct ? 'yes' : 'no '} rank=${s.correct_rank ?? '-'} fp=${s.false_positives} ${(row.time_ms / 1000).toFixed(1)}s${row.cached ? ' (cached)' : ''}`);
    return row;
  } catch (err) {
    console.log(`error: ${err.message.slice(0, 120)}`);
    return { case: c.case, top1_correct: false, correct_rank: null, false_positives: 0, time_ms: Date.now() - t0, error: err.message.slice(0, 200) };
  }
}

// Accuracy is over completed runs only; errored runs (provider failures) are counted separately.
function totals(cases) {
  const ok = cases.filter((r) => !r.error);
  return {
    top1_accuracy: ok.length ? ok.filter((r) => r.top1_correct).length / ok.length : 0,
    top1_correct: ok.filter((r) => r.top1_correct).length,
    completed: ok.length,
    avg_time_ms: ok.length ? Math.round(ok.reduce((a, r) => a + r.time_ms, 0) / ok.length) : null,
    false_positives: ok.reduce((a, r) => a + r.false_positives, 0),
    errors: cases.length - ok.length,
  };
}

let runs;
if (RETRY) {
  // Re-run only the errored cases from the last results file and merge them in.
  const prev = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/public/eval-results.json'), 'utf8'));
  runs = prev.runs;
  for (const run of runs) {
    for (const [i, row] of run.cases.entries()) {
      const c = expected.find((x) => x.case === row.case);
      if (row.error && c) run.cases[i] = await runCase(c, run.mode);
    }
    run.totals = totals(run.cases);
  }
} else {
  runs = [];
  for (const mode of MODES) {
    const cases = [];
    for (const c of expected) cases.push(await runCase(c, mode));
    runs.push({ mode, cases, totals: totals(cases) });
  }
}

const model = runs.flatMap((r) => r.cases).find((r) => r.model)?.model || null;
const out = { generated_at: new Date().toISOString(), model, api: API, fp_threshold: FP_THRESHOLD, runs };
const total = runs.reduce((a, r) => a + r.cases.length, 0);
const errored = runs.reduce((a, r) => a + r.totals.errors, 0);
if (!total || errored === total) {
  console.error('\nEvery run errored; not writing results. Is the backend running and the model configured?');
  process.exit(1);
}
fs.mkdirSync(path.join(ROOT, 'eval/results'), { recursive: true });
const stamp = out.generated_at.replace(/[:.]/g, '-');
fs.writeFileSync(path.join(ROOT, `eval/results/${stamp}.json`), JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(ROOT, 'frontend/public/eval-results.json'), JSON.stringify(out, null, 2));

console.log('\nmode        top1          avg time   false+   errors');
for (const r of runs)
  console.log(
    `${r.mode.padEnd(11)} ${String(r.totals.top1_correct).padStart(2)}/${r.totals.completed} ${(r.totals.top1_accuracy * 100).toFixed(0).padStart(4)}%   ${r.totals.avg_time_ms == null ? '      -' : ((r.totals.avg_time_ms / 1000).toFixed(1) + 's').padStart(7)}   ${String(r.totals.false_positives).padStart(6)}   ${String(r.totals.errors).padStart(6)}`
  );
console.log(`
wrote frontend/public/eval-results.json and eval/results/${stamp}.json`);
