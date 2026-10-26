// Runtime configuration, read once at startup.
module.exports = {
  port: Number(process.env.PORT) || 8080,
  databaseUrl: process.env.DB_URL,
  dbRetries: 5,
  dbRetryDelayMs: 2000,
};
