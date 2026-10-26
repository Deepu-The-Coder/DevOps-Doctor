// Retry GitHub requests that fail at the network level (DNS blips, connect timeouts).
// HTTP error responses are returned as-is; only thrown network errors are retried.
const GITHUB_HOSTS = /^https:\/\/(api\.github\.com|github\.com|raw\.githubusercontent\.com)\//;
const realFetch = globalThis.fetch;

globalThis.fetch = async function fetchWithRetry(input, init) {
  const url = typeof input === 'string' ? input : input?.url || String(input);
  if (!GITHUB_HOSTS.test(url)) return realFetch(input, init);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await realFetch(input, init);
    } catch (err) {
      if (init?.signal?.aborted) throw err;
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  const host = new URL(url).hostname;
  const code = lastErr?.cause?.code || '';
  const e = new Error(`Could not reach ${host}${code ? ` (${code})` : ''}. Check your internet connection and retry.`);
  e.status = 502;
  e.cause = lastErr;
  throw e;
};
