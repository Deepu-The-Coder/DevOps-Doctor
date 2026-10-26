// Builds the "case file" the model sees: redacted repo files and logs, both with line numbers.
import { redact, isRealEnvFile } from './redact.js';

const MAX_LOG_LINES = 400;
const SIGNAL = /error|fail|fatal|exception|refused|timeout|timed out|denied|not found|enotfound|econn|warn|exit|killed|oom|panic|traceback|cannot|unable|missing|undefined/i;

export function prepareFiles(files) {
  let redactions = 0;
  const out = [];
  for (const f of files) {
    if (isRealEnvFile(f.path)) continue;
    const r = redact(f.content);
    redactions += r.count;
    out.push({ path: f.path, content: r.text, lines: r.text.split('\n') });
  }
  return { files: out, redactions };
}

// Keeps original line numbers so evidence refs match what the user sees.
export function prepareLogs(rawLogs) {
  const r = redact(String(rawLogs || '').replace(/\r\n/g, '\n'));
  const all = r.text.split('\n');
  while (all.length && all[all.length - 1] === '') all.pop();
  let picked = all.map((text, i) => ({ n: i + 1, text }));
  if (picked.length > MAX_LOG_LINES) {
    const tailStart = picked.length - 150;
    picked = picked.filter((l, i) => i >= tailStart || SIGNAL.test(l.text)).slice(-MAX_LOG_LINES);
  }
  return { all, picked, redactions: r.count };
}

export function renderCaseFile({ files, logs, mode }) {
  const parts = [];
  if (mode !== 'logs-only') {
    parts.push('=== REPOSITORY FILES ===');
    for (const f of files) {
      parts.push(`--- FILE: ${f.path} (${f.lines.length} lines)`);
      parts.push(f.lines.map((l, i) => `${i + 1}| ${l}`).join('\n'));
    }
  } else {
    parts.push('=== REPOSITORY FILES ===\n(not provided in this mode; cite log lines only)');
  }
  parts.push(`\n=== DEPLOYMENT LOGS (${logs.all.length} lines${logs.picked.length < logs.all.length ? ', filtered to signal lines' : ''}) ===`);
  parts.push(logs.picked.map((l) => `L${l.n}| ${l.text}`).join('\n'));
  return parts.join('\n');
}

// Hosts and IPs mentioned anywhere in the case. Probes may only touch these.
export function mentionedHosts(files, logsAll) {
  const text = files.map((f) => f.content).join('\n') + '\n' + logsAll.join('\n');
  const hosts = new Set();
  for (const m of text.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) hosts.add(m[0]);
  for (const m of text.matchAll(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi)) {
    const h = m[0].toLowerCase();
    if (/\.(js|mjs|cjs|ts|json|ya?ml|md|txt|log|sh|py|lock|toml|env|example|tf)$/.test(h)) continue;
    hosts.add(h);
  }
  return hosts;
}
