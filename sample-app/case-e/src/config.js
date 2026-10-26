// Runtime configuration, read once at startup.
module.exports = {
  port: Number(process.env.HTTP_PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  dbRetries: 5,
  dbRetryDelayMs: 2000,
};
