// Probe Mode: the model asks for safe, read-only checks; we run them and it re-ranks.
// Only 4 tools exist. Network probes may only touch hosts named in the repo or logs,
// and never private, loopback or link-local addresses. No shell commands are run.
import dns from 'node:dns/promises';
import net from 'node:net';
import { chatJSON } from './model.js';
import { renderCaseFile } from './caseFile.js';
import { normalizeDiagnosis, CATEGORIES } from './diagnose.js';
import { readRepoFile } from './github.js';
import { redact } from './redact.js';

export const MAX_ROUNDS = 3;
const MAX_PROBES_PER_ROUND = 4;
const TIMEOUT_MS = 4000;

export const TOOLS = {
  dns_lookup: { args: '{ "host": "db.example.com" }', does: 'Resolve a hostname (A/AAAA).' },
  tcp_connect: { args: '{ "host": "db.example.com", "port": 5432 }', does: 'Try a TCP connection; reports open, refused or timeout.' },
  http_get: { args: '{ "url": "https://api.example.com/health" }', does: 'GET a URL; reports status code and the first 300 bytes. No redirects followed.' },
  read_file: { args: '{ "path": "relative/path/in/repo" }', does: 'Read a repo file that was not in the initial case file.' },
};

const PROBE_SYSTEM = `You are DevOpsDoctor running Probe Mode on a failed deployment.
You may request read-only probes to tell the hypotheses apart. Available tools:
${Object.entries(TOOLS).map(([k, t]) => `- ${k} ${t.args}: ${t.does}`).join('\n')}
Network probes may only target hosts or IPs that literally appear in the case file.
Private, loopback and link-local addresses are refused.

Return ONLY JSON:
{
  "hypotheses": [ ...same schema as before, keep the same "id" for the same hypothesis... ],
  "probes": [ { "tool": "tcp_connect", "args": { ... }, "reason": "which hypothesis this tests and how" } ],
  "done": false
}
Rules: at most ${MAX_PROBES_PER_ROUND} probes. Set "done": true and "probes": [] when more probes
would not change the ranking. Update confidences using probe results; say in "reasoning"
which probe moved it. Evidence refs must still point at real file lines or log lines.
Categories: ${CATEGORIES.join(', ')}.`;

export async function runProbeLoop({ ingest, files, logs, hypotheses, hosts, emit, mock }) {
  const caseFile = renderCaseFile({ files, logs, mode: 'full' });
  let current = hypotheses;
  const history = []; // { round, results }
  emit({ type: 'start', max_rounds: MAX_ROUNDS });

  // Ask for the first set of probes.
  let plan = mock ? mockPlan(hosts, current, 0) : await askModel(caseFile, current, history);
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const probes = (plan.probes || []).slice(0, MAX_PROBES_PER_ROUND);
    if (!probes.length || (plan.done && round > 1)) break;
    emit({ type: 'round', round });

    const results = [];
    for (const p of probes) {
      emit({ type: 'probe_start', round, tool: p.tool, args: p.args, reason: p.reason || '' });
      const result = await runProbe(p, { hosts, ingest, files });
      results.push({ tool: p.tool, args: p.args, reason: p.reason || '', ...result });
      emit({ type: 'probe_result', round, tool: p.tool, args: p.args, reason: p.reason || '', ...result });
    }
    history.push({ round, results });

    plan = mock ? mockPlan(hosts, current, round) : await askModel(caseFile, current, history);
    const next = normalizeDiagnosis({ hypotheses: plan.hypotheses }, { files, logs }).hypotheses;
    if (next.length) {
      const changes = diffRanking(current, next);
      current = next;
      emit({ type: 'rerank', round, hypotheses: current, changes });
    }
    if (plan.done) break;
  }
  emit({ type: 'done', hypotheses: current, rounds: history.length });
}

async function askModel(caseFile, hypotheses, history) {
  const state = {
    current_hypotheses: hypotheses.map(({ dropped_evidence, ...h }) => h),
    probe_history: history,
  };
  const { json } = await chatJSON([
    { role: 'system', content: PROBE_SYSTEM },
    { role: 'user', content: caseFile },
    { role: 'user', content: 'Current state:\n' + JSON.stringify(state, null, 1) },
  ]);
  return {
    hypotheses: Array.isArray(json.hypotheses) ? json.hypotheses : [],
    probes: Array.isArray(json.probes) ? json.probes.filter((p) => p && TOOLS[p.tool]) : [],
    done: Boolean(json.done),
  };
}

function diffRanking(before, after) {
  const prev = new Map(before.map((h, i) => [h.id, { conf: h.confidence, rank: i + 1 }]));
  return after.map((h, i) => {
    const p = prev.get(h.id);
    return {
      id: h.id,
      title: h.title,
      from: p ? p.conf : null,
      to: h.confidence,
      rank_from: p ? p.rank : null,
      rank_to: i + 1,
    };
  });
}

// ---- Tools

export async function runProbe(p, { hosts, ingest, files }) {
  const started = Date.now();
  try {
    const out = await dispatch(p, { hosts, ingest, files });
    return { ...out, ms: Date.now() - started };
  } catch (err) {
    return { status: 'error', ok: false, detail: err.message, ms: Date.now() - started };
  }
}

async function dispatch(p, { hosts, ingest, files }) {
  const a = p.args || {};
  switch (p.tool) {
    case 'dns_lookup': {
      const host = checkHost(a.host, hosts);
      try {
        const addrs = await withTimeout(dns.lookup(host, { all: true }), TIMEOUT_MS);
        return { status: 'resolved', ok: true, detail: addrs.map((x) => x.address).join(', ') };
      } catch (err) {
        return { status: err.code === 'ENOTFOUND' ? 'nxdomain' : 'dns_error', ok: false, detail: err.code || err.message };
      }
    }
    case 'tcp_connect': {
      const host = checkHost(a.host, hosts);
      const port = Number(a.port);
      if (!(port >= 1 && port <= 65535)) throw new Error('invalid port');
      const ip = await resolvePublic(host);
      const r = await tcpCheck(ip, port);
      return { ...r, detail: `${host}${ip !== host ? ` (${ip})` : ''}:${port} ${r.detail}` };
    }
    case 'http_get': {
      let u;
      try {
        u = new URL(String(a.url));
      } catch {
        throw new Error('invalid url');
      }
      if (!/^https?:$/.test(u.protocol)) throw new Error('only http/https');
      checkHost(u.hostname, hosts);
      await resolvePublic(u.hostname);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(u, { method: 'GET', redirect: 'manual', signal: ctrl.signal });
        const body = (await res.text()).slice(0, 300);
        return { status: `http_${res.status}`, ok: res.status < 400, detail: redact(body).text };
      } catch (err) {
        return { status: err.name === 'AbortError' ? 'timeout' : 'http_error', ok: false, detail: err.cause?.code || err.message };
      } finally {
        clearTimeout(t);
      }
    }
    case 'read_file': {
      const r = await readRepoFile(ingest, a.path);
      if (!r.ok) return { status: 'not_found', ok: false, detail: r.detail };
      const content = redact(r.content).text;
      if (!files.find((f) => f.path === a.path)) files.push({ path: a.path, content, lines: content.split('\n') });
      return { status: 'read', ok: true, detail: content.slice(0, 1500) };
    }
    default:
      throw new Error('tool not allowlisted');
  }
}

function checkHost(raw, hosts) {
  const host = String(raw || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host) throw new Error('missing host');
  if (host === 'localhost' || host.endsWith('.localhost')) throw new Error('refused: loopback host');
  if (net.isIP(host) && isPrivate(host)) throw new Error('refused: private or loopback address');
  if (!hosts.has(host)) throw new Error(`refused: ${host} does not appear in the repo or logs`);
  return host;
}

async function resolvePublic(host) {
  if (net.isIP(host)) return host;
  const addrs = await withTimeout(dns.lookup(host, { all: true }), TIMEOUT_MS).catch((err) => {
    throw new Error(`dns: ${err.code || err.message}`);
  });
  if (addrs.some((a) => isPrivate(a.address))) throw new Error('refused: resolves to a private address');
  return addrs[0].address;
}

function tcpCheck(ip, port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: ip, port });
    const done = (r) => {
      sock.destroy();
      resolve(r);
    };
    sock.setTimeout(TIMEOUT_MS, () => done({ status: 'timeout', ok: false, detail: `no response in ${TIMEOUT_MS / 1000}s` }));
    sock.once('connect', () => done({ status: 'open', ok: true, detail: 'connection accepted' }));
    sock.once('error', (err) =>
      done({ status: err.code === 'ECONNREFUSED' ? 'refused' : 'error', ok: false, detail: err.code || err.message })
    );
  });
}

export function isPrivate(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivate(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))]);

// ---- Dev-only mock planner (LLM_MOCK=1)
function mockPlan(hosts, current, round) {
  if (round === 0) {
    const ip = [...hosts].find((h) => net.isIP(h) && !isPrivate(h));
    const name = [...hosts].find((h) => !net.isIP(h) && !/github|npmjs|docker\.io$/.test(h));
    const probes = [];
    if (ip) probes.push({ tool: 'tcp_connect', args: { host: ip, port: 5432 }, reason: 'mock: is the DB address reachable?' });
    else if (name) probes.push({ tool: 'dns_lookup', args: { host: name }, reason: 'mock: does the host resolve?' });
    probes.push({ tool: 'read_file', args: { path: 'package.json' }, reason: 'mock: check driver version' });
    return { hypotheses: current, probes, done: false };
  }
  const next = current.map((h, i) => ({ ...h, confidence: Math.max(0, Math.min(1, h.confidence + (i === 1 ? 0.3 : -0.1))) }));
  return { hypotheses: next, probes: [], done: true };
}
