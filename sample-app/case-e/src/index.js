const express = require('express');
const config = require('./config');
const { pool, connectWithRetry } = require('./db');
const cache = require('./cache');

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

app.get('/orders', async (req, res) => {
  const hit = cache.get('orders');
  if (hit) return res.json(hit);
  const { rows } = await pool.query('SELECT id, status, total FROM orders ORDER BY id DESC LIMIT 50');
  cache.set('orders', rows);
  res.json(rows);
});

async function main() {
  await cache.init();
  console.log('db: connecting');
  await connectWithRetry();
  app.listen(config.port, () => console.log(`orders-api listening on ${config.port}`));
}

main().catch((err) => {
  console.error(`FATAL ${err.message}`);
  process.exit(1);
});
