// Last good diagnosis per (repo, logs, mode), saved to disk. Served when the model fails.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache');

export function cacheKey({ repo, logs, mode }) {
  const id = `${repo.owner}/${repo.repo}@${repo.branch}:${repo.path}|${mode}|${String(logs).replace(/\r\n/g, '\n').trim()}`;
  return crypto.createHash('sha1').update(id).digest('hex');
}

export function readCache(key) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, key + '.json'), 'utf8'));
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, key + '.json'), JSON.stringify(value, null, 1));
  } catch {
    // Read-only filesystem is fine; we just lose the fallback.
  }
}
