// Gemma 4 via DigitalOcean serverless inference (OpenAI-compatible chat completions).

export function modelInfo() {
  return {
    model: process.env.LLM_MOCK === '1' ? 'mock (LLM_MOCK=1)' : process.env.MODEL_ID || '(MODEL_ID not set)',
    mock: process.env.LLM_MOCK === '1',
  };
}

export async function chatJSON(messages, { timeoutMs = 90_000 } = {}) {
  const key = process.env.MODEL_ACCESS_KEY;
  const model = process.env.MODEL_ID;
  const base = (process.env.MODEL_BASE_URL || 'https://inference.do-ai.run/v1').replace(/\/+$/, '');
  if (!key || !model) {
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 4000 }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const e = new Error(`Model API ${res.status}: ${body.slice(0, 300)}`);
      e.status = 502;
      throw e;
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
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

// Models sometimes wrap JSON in prose or ``` fences. Take the outermost object.
export function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start < 0 || end <= start) {
    const e = new Error('Model did not return JSON');
    e.status = 502;
    throw e;
  }
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    const e = new Error('Model returned malformed JSON');
    e.status = 502;
    throw e;
  }
}
