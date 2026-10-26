// Masks secrets in place so line numbers stay the same. Runs on repo files and logs
// before anything is sent to the model or back to the browser.

const RULES = [
  // credentials inside connection URLs: scheme://user:pass@host
  [/\b([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)([^@\s${}]+)(@)/gi, (m, a, pass, c) => (pass.startsWith('${') ? m : `${a}[REDACTED]${c}`)],
  // KEY=value / key: value where key looks secret
  [
    /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|PWD|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CREDENTIALS?)[A-Z0-9_]*\s*[:=]\s*["']?)([^\s"'${}][^\s"']*)/gi,
    (m, k, v) => `${k}[REDACTED]`,
  ],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, () => '[REDACTED_GITHUB_TOKEN]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, () => '[REDACTED_AWS_KEY]'],
  [/\bdop_v1_[a-f0-9]{40,}\b/g, () => '[REDACTED_DO_TOKEN]'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, () => '[REDACTED_API_KEY]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, (m) => m.split('\n').map(() => '[REDACTED_PRIVATE_KEY]').join('\n')],
];

export function redact(text) {
  let count = 0;
  let out = String(text ?? '');
  for (const [re, fn] of RULES) {
    out = out.replace(re, (...args) => {
      const r = fn(...args);
      if (r !== args[0]) count++;
      return r;
    });
  }
  return { text: out, count };
}

// Real .env files (not examples) are dropped entirely: values only, no structure we need.
export function isRealEnvFile(path) {
  return /(^|\/)\.env(\.[^/]*)?$/.test(path) && !/example|sample|template|dist/i.test(path);
}
