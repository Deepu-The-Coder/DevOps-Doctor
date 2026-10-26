// Prints the model ids your key can use. Pick a Gemma one for MODEL_ID.
const base = (process.env.MODEL_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/+$/, '');
const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${process.env.MODEL_ACCESS_KEY}` } });
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = await res.json();
for (const m of data.data || []) if (!process.argv.includes('--gemma') || /gemma/i.test(m.id)) console.log(m.id.replace('models/', ''));
