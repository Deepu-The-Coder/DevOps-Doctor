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

export async function chatJSON(messages, { timeoutMs = 240_000, retries = 1 } = {}) {
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
        max_tokens: 8000,
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
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    if (process.env.MODEL_DEBUG === '1') console.log('[model raw]', text.slice(0, 3000));
    return { json: extractJSON(text), usage: data.usage || null };
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error(`Model timed out after ${timeoutMs / 1000}s`);
      e.status = 504;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
        if (!best || cand.length > best.length) {
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
