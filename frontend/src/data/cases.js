// The sample failures. a–d share the same symptom; e–g are harder (red herrings, misleading errors).
// TODO(open item): if the sample app moves to its own repo, update SAMPLE_BASE.
const SAMPLE_BASE = 'https://github.com/Deepu-The-Coder/DevOps-Doctor/tree/main/sample-app';

const common = {
  branch: 'main',
  stack: 'Node · Express · Postgres',
  platform: 'Docker Compose',
};

export const CASES = [
  {
    ...common,
    id: 'case-a',
    repoUrl: `${SAMPLE_BASE}/case-a`,
    symptom: 'Health check fails after "could not connect to database after 5 retries" (ECONNREFUSED 127.0.0.1:5432)',
    log: '/cases/case-a.log',
    answer: 'TODO: root cause for case-a',
  },
  {
    ...common,
    id: 'case-b',
    repoUrl: `${SAMPLE_BASE}/case-b`,
    symptom: 'Health check fails after "could not connect to database after 5 retries" (ECONNREFUSED 127.0.0.1:5432)',
    log: '/cases/case-b.log',
    answer: 'TODO: root cause for case-b',
  },
  {
    ...common,
    id: 'case-c',
    repoUrl: `${SAMPLE_BASE}/case-c`,
    symptom: 'Health check fails after "could not connect to database after 5 retries" (connection timeout)',
    log: '/cases/case-c.log',
    answer: 'TODO: root cause for case-c',
  },
  {
    ...common,
    id: 'case-d',
    repoUrl: `${SAMPLE_BASE}/case-d`,
    symptom: 'Health check fails after "could not connect to database after 5 retries" (connection terminated)',
    log: '/cases/case-d.log',
    answer: 'TODO: root cause for case-d',
  },
  {
    ...common,
    id: 'case-e',
    repoUrl: `${SAMPLE_BASE}/case-e`,
    symptom: 'Health check refused after the database connects; a Redis ECONNREFUSED 127.0.0.1:6379 warning is in the log',
    log: '/cases/case-e.log',
    answer: 'config.js reads HTTP_PORT (default 3000), but compose sets PORT=8080, so the app listens on 3000 and the health check on 8080 is refused. The Redis warning is a red herring.',
  },
  {
    ...common,
    id: 'case-f',
    repoUrl: `${SAMPLE_BASE}/case-f`,
    symptom: "Container crashes at start with Cannot find module 'dotenv'",
    log: '/cases/case-f.log',
    answer: 'dotenv is only in devDependencies, and the Dockerfile runs npm install --omit=dev, so it is never installed in the image.',
  },
  {
    ...common,
    id: 'case-g',
    repoUrl: `${SAMPLE_BASE}/case-g`,
    symptom: 'password authentication failed for user "orders" right after a password rotation',
    log: '/cases/case-g.log',
    answer: 'The pgdata volume was initialised with the old password. POSTGRES_PASSWORD only applies on first init, so Postgres still expects the old one.',
  },
];

export const getCase = (id) => CASES.find((c) => c.id === id) || null;
