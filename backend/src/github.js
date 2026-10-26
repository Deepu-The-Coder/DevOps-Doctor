// Reads a GitHub repo (optionally a subfolder) and picks the files worth sending to the model.

const MAX_FILES = 40;
const MAX_FILE_BYTES = 60_000;
const MAX_TOTAL_CHARS = 120_000;

const SKIP_DIRS = /(^|\/)(node_modules|dist|build|\.git|coverage|vendor|\.next|out|target|__pycache__)\//;
const SKIP_FILES = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css)|\.map)$/;
const TEXT_EXT = /\.(js|mjs|cjs|ts|tsx|jsx|json|ya?ml|toml|ini|cfg|conf|env|example|py|go|rb|java|kt|rs|php|sh|sql|md|txt|dockerignore|gitignore|properties|xml|gradle|tf|hcl)$/i;
const TEXT_NAMES = /(^|\/)(Dockerfile[^/]*|Procfile|Makefile|\.env[^/]*|\.nvmrc|\.node-version|Gemfile|requirements\.txt|go\.mod)$/i;

// Higher score = more likely to matter for a deploy failure.
function score(path) {
  const p = path.toLowerCase();
  // Deploy / platform config
  if (/(^|\/)(docker-compose|compose)[^/]*\.ya?ml$|fly\.toml$|render\.ya?ml$|railway\.(json|toml)$|vercel\.json$|netlify\.toml$|app\.ya?ml$|(^|\/)(k8s|kubernetes|helm|deploy)\//.test(p)) return 100;
  if (/(^|\/)dockerfile|procfile/.test(p)) return 95;
  if (/(^|\/)package\.json$|requirements\.txt$|go\.mod$|gemfile$/.test(p)) return 90;
  if (/(^|\/)\.env/.test(p)) return 85;
  if (/config|settings|db|database|env/.test(p)) return 80;
  if (/(^|\/)(src|app|lib|server)\//.test(p)) return 60;
  if (/test|spec|__tests__/.test(p)) return 10;
  if (/\.md$/.test(p)) return 15;
  return 40;
}

export function parseRepoUrl(repoUrl, branchOverride) {
  const m = String(repoUrl || '')
    .trim()
    .match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:\/tree\/([^/\s]+)(?:\/(.*?))?)?\/?$/);
  if (!m) throw httpError(400, 'repoUrl must look like https://github.com/owner/repo or .../tree/branch/path');
  const [, owner, repo, urlBranch, subpath] = m;
  return {
    owner,
    repo,
    branch: (branchOverride || '').trim() || urlBranch || 'main',
    path: (subpath || '').replace(/\/+$/, ''),
  };
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function ghHeaders() {
  const h = { 'User-Agent': 'devopsdoctor', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

const ingestCache = new Map(); // key -> { at, value }
const CACHE_MS = 10 * 60 * 1000;

export async function ingestRepo(repoUrl, branch) {
  const ref = parseRepoUrl(repoUrl, branch);
  const key = `${ref.owner}/${ref.repo}@${ref.branch}:${ref.path}`;
  const hit = ingestCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const treeRes = await fetch(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(ref.branch)}?recursive=1`,
    { headers: ghHeaders() }
  );
  if (treeRes.status === 404) throw httpError(404, `Repo or branch not found: ${ref.owner}/${ref.repo}@${ref.branch}`);
  if (treeRes.status === 403 || treeRes.status === 429)
    throw httpError(429, 'GitHub rate limit hit. Set GITHUB_TOKEN on the backend.');
  if (!treeRes.ok) throw httpError(502, `GitHub API error ${treeRes.status}`);
  const tree = await treeRes.json();

  const prefix = ref.path ? ref.path + '/' : '';
  const allPaths = tree.tree
    .filter((t) => t.type === 'blob' && t.path.startsWith(prefix))
    .map((t) => ({ full: t.path, rel: t.path.slice(prefix.length), size: t.size || 0 }));
  if (allPaths.length === 0) throw httpError(404, `No files under "${ref.path || '/'}" on ${ref.branch}`);

  const candidates = allPaths
    .filter((f) => !SKIP_DIRS.test('/' + f.rel) && !SKIP_FILES.test(f.rel))
    .filter((f) => TEXT_EXT.test(f.rel) || TEXT_NAMES.test(f.rel))
    .filter((f) => f.size <= MAX_FILE_BYTES)
    .sort((a, b) => score(b.rel) - score(a.rel) || a.rel.length - b.rel.length)
    .slice(0, MAX_FILES);

  const contents = await mapLimit(candidates, 8, async (f) => {
    const r = await fetch(
      `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${encodeURIComponent(ref.branch)}/${f.full
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      { headers: process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {} }
    );
    if (!r.ok) return null;
    return { path: f.rel, content: (await r.text()).replace(/\r\n/g, '\n') };
  });

  const files = [];
  let total = 0;
  for (const f of contents) {
    if (!f) continue;
    if (total + f.content.length > MAX_TOTAL_CHARS) continue;
    total += f.content.length;
    files.push(f);
  }

  const value = {
    repo: ref,
    sha: tree.sha,
    files,
    tree: allPaths.map((f) => f.rel), // full listing, for read_file probes
    skipped: allPaths.length - files.length,
  };
  ingestCache.set(key, { at: Date.now(), value });
  return value;
}

// Fetch one more file from an already-ingested repo (used by the read_file probe).
export async function readRepoFile(ingest, relPath) {
  const clean = String(relPath || '').replace(/^\/+/, '');
  if (!ingest.tree.includes(clean)) return { ok: false, detail: `not in repo: ${clean}` };
  const existing = ingest.files.find((f) => f.path === clean);
  if (existing) return { ok: true, content: existing.content };
  const full = (ingest.repo.path ? ingest.repo.path + '/' : '') + clean;
  const r = await fetch(
    `https://raw.githubusercontent.com/${ingest.repo.owner}/${ingest.repo.repo}/${encodeURIComponent(
      ingest.repo.branch
    )}/${full.split('/').map(encodeURIComponent).join('/')}`,
    { headers: process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {} }
  );
  if (!r.ok) return { ok: false, detail: `fetch failed ${r.status}` };
  const content = (await r.text()).replace(/\r\n/g, '\n');
  if (content.length > MAX_FILE_BYTES) return { ok: false, detail: 'file too large' };
  ingest.files.push({ path: clean, content });
  return { ok: true, content };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx]);
      } catch {
        out[idx] = null;
      }
    }
  });
  await Promise.all(workers);
  return out;
}
