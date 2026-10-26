// Gemma via any OpenAI-compatible chat completions API.
// Default: Google AI Studio (Gemini API). Also works with Ollama, OpenRouter, etc.
const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const baseUrl = () => (process.env.MODEL_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');

export function providerName() {
  try {
    const h = new URL(baseUrl()).hostname;
    if (h.includes('googleapis')) return 'google-ai-studio';
    if (h === 'localhost' || h === '127.0.0.1') return 'local';
    return h;
  } catch {
    return 'unknown';
  }
}

export function modelInfo() {
  return {
    provider: process.env.LLM_MOCK === '1' ? 'mock' : providerName(),
    model: process.env.LLM_MOCK === '1' ? 'mock (LLM_MOCK=1)' : process.env.MODEL_ID || '(MODEL_ID not set)',
    mock: process.env.LLM_MOCK === '1',
  };
}

export async function chatJSON(messages, { timeoutMs = 240_000, retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await chatOnce(messages, timeoutMs);
    } catch (err) {
      // Provider 5xx and unparseable output are often transient; retry once.
      const transient = err.transient === true;
      if (!transient || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

async function chatOnce(messages, timeoutMs) {
  const key = process.env.MODEL_ACCESS_KEY;
  const model = process.env.MODEL_ID;
  const base = baseUrl();
  if ((!key && providerName() !== 'local') || !model) {
    const e = new Error('Model not configured: set MODEL_ACCESS_KEY and MODEL_ID on the backend.');
    e.status = 503;
    throw e;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model,
        messages: /gemma/i.test(model) ? foldSystem(messages) : messages,
        temperature: 0.1,
        max_tokens: 12000,
        // Stream so bytes keep flowing during long reasoning; idle connections get reset.
        ...(process.env.MODEL_STREAM === '0' ? {} : { stream: true }),
        ...extraBody(),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const e = new Error(`Model API ${res.status}: ${body.replace(/\s+/g, ' ').slice(0, 200)}`);
      e.status = 502;
      e.transient = res.status >= 500 || res.status === 429;
      throw e;
    }
    const { text, usage } = await readCompletion(res);
    if (process.env.MODEL_DEBUG === '1') console.log('[model raw]', text.slice(0, 3000));
    return { json: extractJSON(text), usage };
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error(`Model timed out after ${timeoutMs / 1000}s`);
      e.status = 504;
      throw e;
    }
    if (err.message === 'fetch failed') {
      // Network-level failure (DNS, reset, connect timeout): worth retrying.
      const code = err.cause?.code || err.cause?.message || 'network error';
      const e = new Error(`Could not reach the model API (${code}). Check your internet connection and retry.`);
      e.status = 502;
      e.transient = true;
      e.cause = err;
      console.error('[model] network error:', code);
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Reads either a normal JSON completion or an SSE stream of chunks.
async function readCompletion(res) {
  const type = res.headers.get('content-type') || '';
  if (!type.includes('event-stream')) {
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content ?? '', usage: data.usage || null };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let usage = null;
  const handle = (line) => {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      const chunk = JSON.parse(payload);
      if (chunk.error) {
        const e = new Error(`Model API stream error: ${JSON.stringify(chunk.error).slice(0, 200)}`);
        e.status = 502;
        e.transient = true;
        throw e;
      }
      text += chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? '';
      if (chunk.usage) usage = chunk.usage;
    } catch (err) {
      if (err.status) throw err;
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      handle(buf.slice(0, nl).trim());
      buf = buf.slice(nl + 1);
    }
  }
  handle(buf.trim());
  return { text, usage };
}

// Models may add reasoning (<thought>…</thought>), prose or ``` fences around the JSON.
// Strip reasoning, then take the largest {...} block that parses.
export function extractJSON(text) {
  let src = String(text)
    .replace(/<(thought|think|thinking)>[\s\S]*?<\/\1>/gi, '')
    .replace(/^[\s\S]*<\/(thought|think|thinking)>/i, '');
  const fenced = src.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) src = fenced[1];
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(src.slice(start, end + 1));
    } catch {
      // fall through to the scan below
    }
  }
  let best = null;
  for (let i = src.indexOf('{'); i >= 0; i = src.indexOf('{', i + 1)) {
    let depth = 0;
    let inStr = false;
    for (let j = i; j < src.length; j++) {
      const c = src[j];
      if (inStr) {
        if (c === '\\') j++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        const cand = src.slice(i, j + 1);
        // Prefer the answer object (has "hypotheses"), then the largest one.
        const rank = (x) => (x ? (/"hypotheses"\s*:/.test(x) ? 1e9 : 0) + x.length : -1);
        if (rank(cand) > rank(best)) {
          try {
            JSON.parse(cand);
            best = cand;
          } catch {
            // not valid JSON
          }
        }
        break;
      }
    }
  }
  if (best) return JSON.parse(best);
  const e = new Error(start < 0 ? 'Model did not return JSON' : 'Model returned malformed JSON');
  e.status = 502;
  e.transient = true;
  throw e;
}

// Gemma on Google AI Studio rejects system messages, so fold them into the first user turn.
function foldSystem(messages) {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');
  if (!sys) return rest;
  if (rest[0]?.role === 'user') return [{ role: 'user', content: sys + '\n\n' + rest[0].content }, ...rest.slice(1)];
  return [{ role: 'user', content: sys }, ...rest];
}

// Optional provider-specific fields, e.g. MODEL_EXTRA={"reasoning_effort":"none"}
function extraBody() {
  try {
    return process.env.MODEL_EXTRA ? JSON.parse(process.env.MODEL_EXTRA) : {};
  } catch {
    return {};
  }
}
