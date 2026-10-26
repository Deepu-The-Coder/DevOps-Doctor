// Runtime configuration, read once at startup.
// Loads .env when present so `npm start` works the same locally and in the container.
require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 8080,
  databaseUrl: process.env.DATABASE_URL,
  dbRetries: 5,
  dbRetryDelayMs: 2000,
};
