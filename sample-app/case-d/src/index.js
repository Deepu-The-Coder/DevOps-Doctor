const express = require('express');
const config = require('./config');
const { pool, connectWithRetry } = require('./db');

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
  const { rows } = await pool.query('SELECT id, status, total FROM orders ORDER BY id DESC LIMIT 50');
  res.json(rows);
});

async function main() {
  console.log('db: connecting');
  await connectWithRetry();
  app.listen(config.port, () => console.log(`orders-api listening on ${config.port}`));
}

main().catch((err) => {
  console.error(`FATAL ${err.message}`);
  process.exit(1);
});
