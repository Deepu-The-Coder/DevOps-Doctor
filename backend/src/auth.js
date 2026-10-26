// "Sign in with GitHub" (OAuth web flow). The access token stays on the server in an
// in-memory session; the browser only gets an opaque httpOnly cookie. The token is used
// to read repos (including private ones) and is never sent to the model.
import crypto from 'node:crypto';
import express from 'express';

const SESSION_COOKIE = 'dd_sid';
const STATE_COOKIE = 'dd_oauth_state';
const SESSION_MS = 8 * 60 * 60 * 1000;
const sessions = new Map(); // sid -> { token, user, at }

const clientId = () => process.env.GITHUB_CLIENT_ID || '';
const clientSecret = () => process.env.GITHUB_CLIENT_SECRET || '';
export const authConfigured = () => Boolean(clientId() && clientSecret());

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieOpts(maxAgeMs) {
  const secure = process.env.COOKIE_SECURE === '1';
  return [`Path=/`, `HttpOnly`, `SameSite=${secure ? 'None' : 'Lax'}`, secure ? 'Secure' : '', `Max-Age=${Math.floor(maxAgeMs / 1000)}`]
    .filter(Boolean)
    .join('; ');
}

// Public base URL of the site as the browser sees it (the dev proxy keeps /api same-origin).
function siteBase(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export function sessionFor(req) {
  const sid = parseCookies(req)[SESSION_COOKIE];
  const s = sid && sessions.get(sid);
  if (!s) return null;
  if (Date.now() - s.at > SESSION_MS) {
    sessions.delete(sid);
    return null;
  }
  return s;
}

// Token to use for GitHub calls: the signed-in user's, else the server's GITHUB_TOKEN.
export const githubTokenFor = (req) => sessionFor(req)?.token || process.env.GITHUB_TOKEN || '';

export const authRouter = express.Router();

authRouter.get('/me', (req, res) => {
  const s = sessionFor(req);
  res.json({ configured: authConfigured(), user: s ? s.user : null });
});

authRouter.get('/github/login', (req, res) => {
  if (!authConfigured()) return res.status(503).send('GitHub sign-in is not configured on the server.');
  const state = crypto.randomBytes(16).toString('hex');
  const back = typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '/app';
  res.setHeader('Set-Cookie', `${STATE_COOKIE}=${state}.${encodeURIComponent(back)}; ${cookieOpts(10 * 60 * 1000)}`);
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: `${siteBase(req)}/api/auth/github/callback`,
    scope: process.env.GITHUB_OAUTH_SCOPE || 'read:user repo',
    state,
    allow_signup: 'false',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

authRouter.get('/github/callback', async (req, res) => {
  const [expected, backRaw] = String(parseCookies(req)[STATE_COOKIE] || '').split('.');
  const back = decodeURIComponent(backRaw || '/app');
  const clear = `${STATE_COOKIE}=; ${cookieOpts(0)}`;
  if (!req.query.code || !expected || req.query.state !== expected) {
    res.setHeader('Set-Cookie', clear);
    return res.redirect(`${siteBase(req)}${back}${back.includes('?') ? '&' : '?'}auth_error=state`);
  }
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId(), client_secret: clientSecret(), code: req.query.code }),
    });
    const tok = await tokenRes.json();
    if (!tok.access_token) throw new Error(tok.error_description || 'no token');

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': 'devopsdoctor', Accept: 'application/vnd.github+json' },
    });
    const u = await userRes.json();
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, {
      token: tok.access_token,
      scopes: tok.scope || '',
      user: { login: u.login, name: u.name || u.login, avatar_url: u.avatar_url, html_url: u.html_url },
      at: Date.now(),
    });
    res.setHeader('Set-Cookie', [clear, `${SESSION_COOKIE}=${sid}; ${cookieOpts(SESSION_MS)}`]);
    res.redirect(`${siteBase(req)}${back}`);
  } catch {
    res.setHeader('Set-Cookie', clear);
    res.redirect(`${siteBase(req)}${back}${back.includes('?') ? '&' : '?'}auth_error=exchange`);
  }
});

authRouter.post('/logout', (req, res) => {
  const sid = parseCookies(req)[SESSION_COOKIE];
  if (sid) sessions.delete(sid);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieOpts(0)}`);
  res.json({ ok: true });
});

// The signed-in user's repos, most recently pushed first.
export async function listUserRepos(req, res) {
  const s = sessionFor(req);
  if (!s) return res.status(401).json({ error: 'Sign in with GitHub first' });
  const r = await fetch('https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member', {
    headers: { Authorization: `Bearer ${s.token}`, 'User-Agent': 'devopsdoctor', Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) return res.status(502).json({ error: `GitHub API error ${r.status}` });
  const repos = await r.json();
  res.json({
    repos: repos.map((x) => ({
      full_name: x.full_name,
      html_url: x.html_url,
      private: x.private,
      default_branch: x.default_branch,
      pushed_at: x.pushed_at,
      language: x.language,
    })),
  });
}
