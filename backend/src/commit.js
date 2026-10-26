// Write path: read a file for editing, then commit a reviewed change back to GitHub.
// Requires a signed-in user (their OAuth token). Nothing is written without an explicit
// request from the UI, and content still holding redaction markers is refused.
import { parseRepoUrl, httpError } from './github.js';
import { sessionFor } from './auth.js';

const GH = 'https://api.github.com';
const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  'User-Agent': 'devopsdoctor',
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
});

function requireSession(req) {
  const s = sessionFor(req);
  if (!s) throw httpError(401, 'Sign in with GitHub to commit changes.');
  return s;
}

// Joins the repo subfolder and a repo-relative path, rejecting anything that escapes it.
function fullPath(ref, path) {
  const clean = String(path || '').replace(/^\.?\/+/, '').trim();
  if (!clean || clean.split('/').some((seg) => seg === '..' || seg === '')) throw httpError(400, 'Invalid file path');
  return (ref.path ? ref.path + '/' : '') + clean;
}

const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
const validBranch = (b) => /^[A-Za-z0-9._\/-]{1,200}$/.test(b) && !b.includes('..') && !b.startsWith('/') && !b.endsWith('/');

async function gh(token, method, url, body) {
  const res = await fetch(GH + url, { method, headers: headers(token), body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function ghError(res, data, what) {
  if (res.status === 401) return httpError(401, 'GitHub session expired. Sign in again.');
  if (res.status === 403 || res.status === 404)
    return httpError(403, `${what}: no write access to this repo with your GitHub account (${res.status}).`);
  if (res.status === 409) return httpError(409, `${what}: the file changed on GitHub since it was loaded. Reload and try again.`);
  if (res.status === 422) return httpError(422, `${what}: ${data.message || 'rejected by GitHub'}`);
  return httpError(502, `${what}: GitHub error ${res.status}`);
}

// POST /api/github/file { repoUrl, branch, path } -> { path, content, sha, exists }
export async function readFileForEdit(req, res) {
  const s = requireSession(req);
  const ref = parseRepoUrl(req.body.repoUrl, req.body.branch);
  const p = fullPath(ref, req.body.path);
  const { res: r, data } = await gh(s.token, 'GET', `/repos/${ref.owner}/${ref.repo}/contents/${encPath(p)}?ref=${encodeURIComponent(ref.branch)}`);
  if (r.status === 404) return res.json({ path: req.body.path, full_path: p, content: '', sha: null, exists: false });
  if (!r.ok) throw ghError(r, data, 'Read file');
  if (Array.isArray(data) || data.type !== 'file') throw httpError(400, 'Path is not a file');
  const content = Buffer.from(data.content || '', 'base64').toString('utf8');
  res.json({ path: req.body.path, full_path: p, content, sha: data.sha, exists: true });
}

// POST /api/github/commit
// { repoUrl, branch, path, content, sha, message, newBranch?, openPr?, prBody? }
export async function commitFile(req, res) {
  const s = requireSession(req);
  const ref = parseRepoUrl(req.body.repoUrl, req.body.branch);
  const p = fullPath(ref, req.body.path);
  const content = String(req.body.content ?? '');
  const message = String(req.body.message || '').trim();
  const newBranch = String(req.body.newBranch || '').trim();

  if (!message) throw httpError(400, 'Commit message is required');
  if (content.length > 1_000_000) throw httpError(413, 'File too large');
  if (/\[REDACTED[A-Z_]*\]/.test(content))
    throw httpError(400, 'The content still contains a [REDACTED] placeholder. Restore the real value before committing.');
  if (newBranch && !validBranch(newBranch)) throw httpError(400, 'Invalid branch name');

  const repo = `/repos/${ref.owner}/${ref.repo}`;
  let target = ref.branch;

  if (newBranch && newBranch !== ref.branch) {
    const base = await gh(s.token, 'GET', `${repo}/git/ref/heads/${encodeURIComponent(ref.branch)}`);
    if (!base.res.ok) throw ghError(base.res, base.data, 'Read base branch');
    const created = await gh(s.token, 'POST', `${repo}/git/refs`, { ref: `refs/heads/${newBranch}`, sha: base.data.object.sha });
    if (!created.res.ok && !(created.res.status === 422 && /already exists/i.test(created.data.message || '')))
      throw ghError(created.res, created.data, 'Create branch');
    target = newBranch;
  }

  // Current blob sha on the target branch (needed to update; absent for new files).
  let sha = null;
  const cur = await gh(s.token, 'GET', `${repo}/contents/${encPath(p)}?ref=${encodeURIComponent(target)}`);
  if (cur.res.ok) sha = cur.data.sha;
  else if (cur.res.status !== 404) throw ghError(cur.res, cur.data, 'Read file');
  // Committing straight to the loaded branch: refuse if someone changed the file meanwhile.
  if (target === ref.branch && req.body.sha && sha && req.body.sha !== sha)
    throw httpError(409, 'The file changed on GitHub since it was loaded. Reload and try again.');

  const put = await gh(s.token, 'PUT', `${repo}/contents/${encPath(p)}`, {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: target,
    ...(sha ? { sha } : {}),
  });
  if (!put.res.ok) throw ghError(put.res, put.data, 'Commit');

  const out = {
    branch: target,
    path: p,
    commit_sha: put.data.commit?.sha,
    commit_url: put.data.commit?.html_url,
    file_url: put.data.content?.html_url,
    pr_url: null,
  };

  if (req.body.openPr && target !== ref.branch) {
    const pr = await gh(s.token, 'POST', `${repo}/pulls`, {
      title: message.split('\n')[0].slice(0, 120),
      head: target,
      base: ref.branch,
      body: String(req.body.prBody || 'Suggested by DevOpsDoctor and reviewed before committing.').slice(0, 10_000),
    });
    if (pr.res.ok) out.pr_url = pr.data.html_url;
    else if (pr.res.status === 422 && /already exists/i.test(JSON.stringify(pr.data))) out.pr_note = 'A pull request for this branch already exists.';
    else out.pr_note = `Committed, but opening the PR failed: ${pr.data.message || pr.res.status}`;
  }
  res.json(out);
}
