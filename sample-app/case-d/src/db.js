const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5000,
  ssl: config.databaseUrl ? { rejectUnauthorized: false } : false,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectWithRetry() {
  for (let attempt = 1; attempt <= config.dbRetries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('db: connected');
      return;
    } catch (err) {
      console.error(`db: attempt ${attempt}/${config.dbRetries} failed: ${err.message}`);
      await sleep(config.dbRetryDelayMs);
    }
  }
  throw new Error(`could not connect to database after ${config.dbRetries} retries`);
}

module.exports = { pool, connectWithRetry };
