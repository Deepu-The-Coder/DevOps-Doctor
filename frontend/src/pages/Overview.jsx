import { Link } from 'react-router-dom';
import HypothesisCard from '../components/HypothesisCard.jsx';
import Footer from '../components/Footer.jsx';
import { Tag } from '../components/ui.jsx';
import './Overview.css';

// Static preview, shaped like a real case-a result from the workspace.
const PREVIEW = [
  {
    id: 'h1',
    title: 'Env var name mismatch: code reads DB_URL, compose sets DATABASE_URL',
    category: 'env',
    confidence: 0.95,
    evidence: [
      { type: 'file', path: 'src/config.js', line: 4, text: '  databaseUrl: process.env.DB_URL,' },
      { type: 'file', path: 'docker-compose.yml', line: 5, text: '      DATABASE_URL: postgresql://…@db:5432/orders' },
      { type: 'log', line: 14, text: 'db: attempt 1/5 failed: connect ECONNREFUSED 127.0.0.1:5432' },
    ],
    rule_out: 'DB_URL is set in the container env',
  },
  {
    id: 'h2',
    title: 'Postgres not ready when the app starts',
    category: 'platform',
    confidence: 0.2,
    evidence: [{ type: 'log', line: 13, text: ' Container orders-db-1  Healthy' }],
    rule_out: 'db reports healthy before the app starts',
  },
  {
    id: 'h3',
    title: 'Wrong database port in connection string',
    category: 'config',
    confidence: 0.1,
    evidence: [{ type: 'file', path: 'docker-compose.yml', line: 5, text: '' }],
    rule_out: 'port 5432 matches the db service',
  },
];

const SYMPTOM = 'FATAL could not connect to database after 5 retries';
const CAUSES = [
  { id: 'case-a', category: 'env', cause: 'Code reads DB_URL; compose sets DATABASE_URL.', where: 'src/config.js · docker-compose.yml' },
  { id: 'case-b', category: 'platform', cause: 'DATABASE_URL is only a build arg, so it is missing at runtime.', where: 'Dockerfile · docker-compose.yml' },
  { id: 'case-c', category: 'config', cause: 'Compose hard-codes an old, unreachable database IP.', where: 'docker-compose.yml' },
  { id: 'case-d', category: 'dependency', cause: 'pg@7.4.3 is incompatible with Node 20.', where: 'package.json' },
];

const STEPS = [
  ['Ingest repo', 'Reads deploy config, Dockerfile, manifests and source from GitHub. Secrets are masked; .env files are never read.'],
  ['Extract log signal', 'Keeps error lines with their original line numbers so every claim can point at a line.'],
  ['Rank hypotheses', 'Gemma 4 returns 3–5 causes with confidence, evidence and a rule-out check. Refs that don’t exist are dropped.'],
  ['Probe and re-rank', 'Optional: the model orders read-only DNS, TCP, HTTP and file checks, then re-ranks. Max 3 rounds.'],
];

const COMPARE = [
  ['Input', 'An error message pasted in by hand', 'The repo (config, Dockerfile, deps, source) and the full deploy log'],
  ['Output', 'One guess or a generic checklist', '3–5 ranked hypotheses with confidence and a suggested patch'],
  ['Uncertainty', 'Hidden; every answer sounds sure', 'Explicit confidences, plus what would rule each cause out'],
  ['Verification', 'You check the claims yourself', 'Every file:line and log-line ref is checked; fakes are dropped and flagged'],
  ['Code vs infra', 'Sees only what you paste', 'Compares what the code reads with what the platform sets'],
];

export default function Overview() {
  return (
    <div className="ov-page">
      <div className="ov">
        <section className="ov-hero">
          <div className="ov-hero-text">
            <h1>DevOpsDoctor</h1>
            <p className="ov-lede">
              Reads your GitHub repo and your failed deploy's logs together, and returns a ranked differential diagnosis
              with file:line evidence for each cause.
            </p>
            <p className="ov-sub">One investigation workflow for both code-level bugs and deployment failures.</p>
            <div className="ov-cta">
              <Link className="btn btn-primary btn-md" to="/app">
                Open workspace
              </Link>
              <Link className="btn btn-secondary btn-md" to="/cases">
                Try a broken app
              </Link>
            </div>
          </div>
          <div className="ov-preview" aria-label="Example diagnosis">
            <div className="ov-preview-head">
              <span className="section-label">Differential diagnosis</span>
              <span className="mono dim">case-a</span>
            </div>
            <div className="ov-preview-list">
              {PREVIEW.map((h, i) => (
                <HypothesisCard key={h.id} h={h} rank={i + 1} top={i === 0} compact />
              ))}
            </div>
          </div>
        </section>

        <section className="ov-section">
          <h2>Same symptom, four causes</h2>
          <p className="ov-section-sub">
            Four deploys of the same app print the same fatal line. Logs alone can't tell them apart; the repo can.
          </p>
          <div className="ov-causes">
            {CAUSES.map((c) => (
              <Link key={c.id} to={`/app?case=${c.id}`} className="ov-cause">
                <div className="ov-symptom mono">{SYMPTOM}</div>
                <div className="ov-cause-body">
                  <div className="ov-cause-top">
                    <Tag category={c.category} />
                    <span className="mono dim">{c.id}</span>
                  </div>
                  <div className="ov-cause-text">{c.cause}</div>
                  <div className="mono dim ov-where">{c.where}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="ov-section">
          <h2>How a diagnosis runs</h2>
          <ol className="ov-steps">
            {STEPS.map(([t, d], i) => (
              <li key={t}>
                <span className="ov-step-n mono">{i + 1}</span>
                <div className="ov-step-title">{t}</div>
                <div className="ov-step-text">{d}</div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ov-section">
          <h2>Compared to pasting the error into a chatbot</h2>
          <div className="table-scroll">
            <table className="ov-compare">
              <thead>
                <tr>
                  <th />
                  <th>Typical workflow</th>
                  <th>DevOpsDoctor</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([k, a, b]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td>{a}</td>
                    <td>{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ov-section">
          <h2>Safety model</h2>
          <ul className="ov-safety">
            <li>
              <span className="mono">4 tools</span> Probes are allowlisted and read-only: dns_lookup, tcp_connect, http_get,
              read_file.
            </li>
            <li>
              <span className="mono">hosts</span> Network probes only reach hosts named in the repo or logs; private and
              loopback addresses are refused.
            </li>
            <li>
              <span className="mono">secrets</span> Passwords, tokens and keys are masked before anything is sent to the
              model.
            </li>
            <li>
              <span className="mono">no exec</span> Nothing runs shell commands, writes files or applies patches.
            </li>
          </ul>
          <p className="ov-more">
            Details in <Link to="/how-it-works">How it works</Link>. Measured results on <Link to="/benchmarks">Benchmarks</Link>.
          </p>
        </section>
      </div>
      <Footer />
    </div>
  );
}
