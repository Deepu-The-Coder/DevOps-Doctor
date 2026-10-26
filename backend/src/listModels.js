// Prints the model ids your MODEL_ACCESS_KEY can use. Pick the Gemma 4 one for MODEL_ID.
const base = (process.env.MODEL_BASE_URL || 'https://inference.do-ai.run/v1').replace(/\/+$/, '');
const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${process.env.MODEL_ACCESS_KEY}` } });
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = await res.json();
for (const m of data.data || []) console.log(m.id);
