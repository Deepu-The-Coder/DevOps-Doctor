// All backend calls. In dev, Vite proxies /api to the backend (see vite.config.js).
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

async function post(path, body, signal) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Backend unreachable. Is it running?');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res;
}

export async function health() {
  const res = await fetch(`${BASE}/api/health`, { credentials: 'include' });
  if (!res.ok) throw new Error('unhealthy');
  return res.json();
}

export async function ingest({ repoUrl, branch }, signal) {
  return (await post('/api/ingest', { repoUrl, branch }, signal)).json();
}

export async function diagnose({ repoUrl, branch, logs, mode }, signal) {
  return (await post('/api/diagnose', { repoUrl, branch, logs, mode }, signal)).json();
}

// Streams NDJSON events from the probe loop; calls onEvent for each one.
export async function probe({ repoUrl, branch, logs, hypotheses }, onEvent, signal) {
  const res = await post('/api/probe', { repoUrl, branch, logs, hypotheses }, signal);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
  if (buf.trim()) onEvent(JSON.parse(buf));
}

// ---- GitHub sign-in
export const loginUrl = (next) => `${BASE}/api/auth/github/login?next=${encodeURIComponent(next || '/app')}`;

export async function me() {
  const res = await fetch(`${BASE}/api/auth/me`, { credentials: 'include' });
  if (!res.ok) throw new Error('auth unavailable');
  return res.json();
}

export async function logout() {
  await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
}

export async function myRepos() {
  const res = await fetch(`${BASE}/api/github/repos`, { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data.repos;
}
