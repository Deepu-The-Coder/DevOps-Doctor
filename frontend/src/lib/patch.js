// Applying model-written unified diffs (which are often slightly off), and diffing two texts.

function parseHunks(diff) {
  const hunks = [];
  let cur = null;
  for (const raw of String(diff || '').replace(/\r\n/g, '\n').split('\n')) {
    if (raw.startsWith('---') || raw.startsWith('+++') || raw.startsWith('\\')) continue;
    const m = raw.match(/^@@\s*-(\d+)(?:,\d+)?\s+\+\d+(?:,\d+)?\s*@@/);
    if (m || raw.startsWith('@@')) {
      cur = { oldStart: m ? Number(m[1]) : 0, old: [], next: [] };
      hunks.push(cur);
      continue;
    }
    if (!cur) {
      cur = { oldStart: 0, old: [], next: [] };
      hunks.push(cur);
    }
    if (raw.startsWith('-')) cur.old.push(raw.slice(1));
    else if (raw.startsWith('+')) cur.next.push(raw.slice(1));
    else {
      const ctx = raw.startsWith(' ') ? raw.slice(1) : raw; // models sometimes drop the leading space
      cur.old.push(ctx);
      cur.next.push(ctx);
    }
  }
  // Trailing blank context lines are usually artefacts of the model's formatting.
  for (const h of hunks) {
    while (h.old.length && h.next.length && h.old[h.old.length - 1] === '' && h.next[h.next.length - 1] === '') {
      h.old.pop();
      h.next.pop();
    }
  }
  return hunks.filter((h) => h.old.length || h.next.length);
}

function findBlock(lines, block, hint) {
  if (!block.length) return Math.max(0, Math.min(hint, lines.length));
  const eq = [(a, b) => a.trimEnd() === b.trimEnd(), (a, b) => a.trim() === b.trim()];
  for (const same of eq) {
    const fits = (i) => block.every((b, k) => lines[i + k] !== undefined && same(lines[i + k], b));
    for (let d = 0; d < lines.length; d++) {
      for (const i of d === 0 ? [hint] : [hint - d, hint + d]) if (i >= 0 && i + block.length <= lines.length && fits(i)) return i;
    }
  }
  return -1;
}

// Returns { content, applied, failed } where failed is the number of hunks that didn't match.
export function applyPatch(original, diff) {
  const lines = String(original).split('\n');
  const hunks = parseHunks(diff);
  let offset = 0;
  let failed = 0;
  for (const h of hunks) {
    const at = findBlock(lines, h.old, Math.max(0, h.oldStart - 1 + offset));
    if (at < 0) {
      failed++;
      continue;
    }
    lines.splice(at, h.old.length, ...h.next);
    offset += h.next.length - h.old.length;
  }
  return { content: lines.join('\n'), applied: hunks.length - failed, failed, total: hunks.length };
}

// Line diff (LCS). Returns a unified-style string with 2 lines of context per change.
export function diffText(a, b, path = 'file') {
  const A = String(a).split('\n');
  const B = String(b).split('\n');
  const n = A.length;
  const m = B.length;
  if (n * m > 4_000_000) return `--- a/${path}\n+++ b/${path}\n@@ file too large to preview @@`;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) ops.push([' ', A[i++], i, j++ + 1]);
    // Prefer deletions first so a changed line reads as - old, + new.
    else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) ops.push(['-', A[i++], i, j]);
    else ops.push(['+', B[j++], i, j]);
  }
  const changed = ops.map((o) => o[0] !== ' ');
  if (!changed.includes(true)) return '';
  const keep = ops.map((_, k) => changed.slice(Math.max(0, k - 2), k + 3).includes(true));
  const out = [`--- a/${path}`, `+++ b/${path}`];
  let inHunk = false;
  ops.forEach((o, k) => {
    if (!keep[k]) {
      inHunk = false;
      return;
    }
    if (!inHunk) {
      out.push(`@@ line ${o[2] || 1} @@`);
      inHunk = true;
    }
    out.push(o[0] + o[1]);
  });
  return out.join('\n');
}
