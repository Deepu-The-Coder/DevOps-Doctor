// Optional response cache. Uses Redis when reachable, otherwise an in-memory map.
const net = require('net');
const config = require('./config');

const memory = new Map();

function probeRedis() {
  const { hostname, port } = new URL(config.redisUrl);
  return new Promise((resolve) => {
    const sock = net.connect({ host: hostname, port: Number(port) || 6379 });
    sock.setTimeout(1000);
    sock.once('connect', () => (sock.end(), resolve(true)));
    sock.once('timeout', () => (sock.destroy(), resolve(false)));
    sock.once('error', (err) => {
      console.warn(`cache: redis unavailable (${err.code} ${hostname}:${port || 6379}), falling back to in-memory cache`);
      resolve(false);
    });
  });
}

module.exports = {
  init: probeRedis,
  get: (k) => memory.get(k),
  set: (k, v) => memory.set(k, v),
};
