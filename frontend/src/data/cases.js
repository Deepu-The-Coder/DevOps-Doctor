// The 4 sample failures. All share the same symptom; the root causes differ.
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
];

export const getCase = (id) => CASES.find((c) => c.id === id) || null;
