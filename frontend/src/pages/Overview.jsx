import { useState } from 'react';
import { Link } from 'react-router-dom';
import HypothesisCard from '../components/HypothesisCard.jsx';
import Footer from '../components/Footer.jsx';
import { Tag } from '../components/ui.jsx';
import './Overview.css';

const SYMPTOM = 'FATAL could not connect to database after 5 retries';

// Illustrative output per sample case (abridged). Same symptom, different evidence.
const EXAMPLES = {
  'case-a': {
    driver: 'connect ECONNREFUSED 127.0.0.1:5432',
    hyps: [
      { id: 'a1', title: 'Code reads DB_URL, compose sets DATABASE_URL', category: 'env', confidence: 0.95, evidence: [{ type: 'file', path: 'src/config.js', line: 4 }, { type: 'file', path: 'docker-compose.yml', line: 5 }, { type: 'log', line: 14 }], rule_out: 'DB_URL is set in the container' },
      { id: 'a2', title: 'Postgres not ready when the app starts', category: 'platform', confidence: 0.2, evidence: [{ type: 'log', line: 9 }], rule_out: 'db is healthy before app start' },
      { id: 'a3', title: 'Wrong port in connection string', category: 'config', confidence: 0.1, evidence: [{ type: 'file', path: 'docker-compose.yml', line: 5 }], rule_out: 'port matches the db service' },
    ],
  },
  'case-b': {
    driver: 'connect ECONNREFUSED 127.0.0.1:5432',
    hyps: [
      { id: 'b1', title: 'DATABASE_URL is a build arg only, missing at runtime', category: 'platform', confidence: 0.95, evidence: [{ type: 'file', path: 'docker-compose.yml', line: 6 }, { type: 'file', path: 'Dockerfile', line: 3 }, { type: 'log', line: 14 }], rule_out: 'env shows DATABASE_URL in the container' },
      { id: 'b2', title: 'pg falls back to localhost without a URL', category: 'config', confidence: 0.4, evidence: [{ type: 'file', path: 'src/db.js', line: 5 }], rule_out: 'connectionString is defined' },
      { id: 'b3', title: 'Database not ready at startup', category: 'platform', confidence: 0.1, evidence: [{ type: 'log', line: 9 }], rule_out: 'db healthcheck passed first' },
    ],
  },
  'case-c': {
    driver: 'Connection terminated due to connection timeout',
    hyps: [
      { id: 'c1', title: 'Compose points DATABASE_URL at old IP 203.0.113.24', category: 'config', confidence: 0.95, evidence: [{ type: 'file', path: 'docker-compose.yml', line: 5 }, { type: 'log', line: 14 }], rule_out: 'tcp_connect to that IP succeeds' },
      { id: 'c2', title: 'Egress to the external database is blocked', category: 'network', confidence: 0.4, evidence: [{ type: 'log', line: 14 }], rule_out: 'other hosts on 5432 are reachable' },
      { id: 'c3', title: 'Server rejects the TLS handshake', category: 'config', confidence: 0.1, evidence: [{ type: 'file', path: 'src/db.js', line: 7 }], rule_out: 'failure is before TLS' },
    ],
  },
  'case-d': {
    driver: 'Connection terminated unexpectedly',
    hyps: [
      { id: 'd1', title: 'pg@7.4.3 is incompatible with Node 20', category: 'dependency', confidence: 0.85, evidence: [{ type: 'file', path: 'package.json', line: 14 }, { type: 'log', line: 4 }], rule_out: 'pg >= 8 is installed' },
      { id: 'd2', title: 'Wrong credentials for the db user', category: 'env', confidence: 0.2, evidence: [{ type: 'file', path: 'docker-compose.yml', line: 5 }], rule_out: 'psql login succeeds' },
      { id: 'd3', title: 'Database restarts during startup', category: 'platform', confidence: 0.1, evidence: [{ type: 'log', line: 10 }], rule_out: 'db container stays up' },
    ],
  },
};

const CAUSES = [
  { id: 'case-a', category: 'env', cause: 'Code reads DB_URL; compose sets DATABASE_URL.', where: 'src/config.js · docker-compose.yml' },
  { id: 'case-b', category: 'platform', cause: 'DATABASE_URL is only a build arg, so it is missing at runtime.', where: 'Dockerfile · docker-compose.yml' },
  { id: 'case-c', category: 'config', cause: 'Compose hard-codes an old, unreachable database IP.', where: 'docker-compose.yml' },
  { id: 'case-d', category: 'dependency', cause: 'pg@7.4.3 is incompatible with Node 20.', where: 'package.json' },
];

const STATS = [
  ['4', 'sample failures, one symptom'],
  ['6', 'cause categories, code to infra'],
  ['4', 'read-only probe tools'],
  ['0', 'shell commands ever executed'],
];

const STEPS = [
  { t: 'Ingest repo', d: 'Deploy config, Dockerfile, manifests and source from GitHub. Secrets masked; .env never read.', icon: 'repo' },
  { t: 'Extract log signal', d: 'Error lines keep their original numbers, so every claim can point at a line.', icon: 'log' },
  { t: 'Rank hypotheses', d: 'Gemma 4 returns 3–5 causes with confidence, evidence and a rule-out check.', icon: 'rank' },
  { t: 'Probe and re-rank', d: 'Optional DNS, TCP, HTTP and file checks. The ranking updates live. Max 3 rounds.', icon: 'probe' },
];

const COMPARE = [
  ['Input', 'An error message pasted in by hand', 'The repo (config, Dockerfile, deps, source) and the full deploy log'],
  ['Output', 'One confident guess or a generic checklist', '3–5 ranked hypotheses with confidence and a suggested patch'],
  ['Uncertainty', 'Hidden; every answer sounds sure', 'Explicit confidences, plus what would rule each cause out'],
  ['Verification', 'You check every claim yourself', 'Each file:line and log ref is checked; invented ones are dropped and flagged'],
  ['Code vs infra', 'Sees only what you paste', 'Compares what the code reads with what the platform sets'],
];

const SAFETY = [
  ['allowlist', 'Only 4 probe tools exist: dns_lookup, tcp_connect, http_get, read_file. All read-only.'],
  ['hosts', 'Network probes only reach hosts named in the repo or logs. Private and loopback addresses are refused.'],
  ['secrets', 'Passwords, tokens and keys are masked before anything reaches the model. .env files are never read.'],
  ['you commit', 'Nothing runs shell commands. A patch is only written to GitHub after you sign in, review the diff and press Commit, by default to a new branch.'],
];

export default function Overview() {
  return (
    <div className="ov-page">
      <div className="ov-hero-band">
        <div className="ov">
          <section className="ov-hero">
            <div className="ov-hero-text">
              <div className="ov-eyebrow mono">
                <span className="ov-dot" /> differential diagnosis for failed deploys
              </div>
              <h1>
                Your deploy failed.
                <br />
                <span className="ov-h1-muted">Was it the code, the config, or the network?</span>
              </h1>
              <p className="ov-lede">
                DevOpsDoctor reads your GitHub repo and the deploy log together, then ranks the likely root causes with
                file:line evidence for each one.
              </p>
              <div className="ov-cta">
                <Link className="btn btn-primary btn-md" to="/app">
                  Open workspace
                </Link>
                <Link className="btn btn-secondary btn-md" to="/cases">
                  Try a broken app
                </Link>
              </div>
              <div className="ov-trust mono">Gemma 4 · read-only probes · secrets masked</div>
            </div>
            <HeroPreview />
          </section>

          <dl className="ov-stats">
            {STATS.map(([n, l]) => (
              <div key={l}>
                <dt className="mono">{n}</dt>
                <dd>{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="ov">
        <section className="ov-section">
          <SectionHead n="01" title="Same symptom, four causes">
            Four deploys of the same app print the same fatal line. Logs alone can't tell them apart. The repo can.
          </SectionHead>
          <div className="ov-fan">
            <div className="ov-fan-symptom mono">
              <span className="ov-err">ERR</span> {SYMPTOM}
            </div>
            <svg className="ov-fan-lines" viewBox="0 0 1000 56" preserveAspectRatio="none" aria-hidden="true">
              {[125, 375, 625, 875].map((x) => (
                <path key={x} d={`M500,0 C500,30 ${x},26 ${x},56`} />
              ))}
            </svg>
            <div className="ov-causes">
              {CAUSES.map((c) => (
                <Link key={c.id} to={`/app?case=${c.id}`} className="ov-cause">
                  <div className="ov-cause-top">
                    <Tag category={c.category} />
                    <span className="mono dim">{c.id}</span>
                  </div>
                  <div className="ov-cause-text">{c.cause}</div>
                  <div className="mono dim ov-where">{c.where}</div>
                  <div className="ov-cause-go mono">open in workspace →</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="ov-section">
          <SectionHead n="02" title="How a diagnosis runs" />
          <ol className="ov-steps">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <div className="ov-step-top">
                  <span className="ov-step-n mono">{i + 1}</span>
                  <StepIcon name={s.icon} />
                </div>
                <div className="ov-step-title">{s.t}</div>
                <div className="ov-step-text">{s.d}</div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ov-section">
          <SectionHead n="03" title="Compared to pasting the error into a chatbot" />
          <div className="ov-compare">
            <div className="ov-compare-head">
              <span />
              <span className="section-label">Typical workflow</span>
              <span className="section-label ov-accent-label">DevOpsDoctor</span>
            </div>
            {COMPARE.map(([k, a, b]) => (
              <div className="ov-compare-row" key={k}>
                <span className="ov-compare-k">{k}</span>
                <span className="ov-compare-a">
                  <span className="ov-mark bad" aria-label="limitation">
                    ✗
                  </span>
                  {a}
                </span>
                <span className="ov-compare-b">
                  <span className="ov-mark ok" aria-label="advantage">
                    ✓
                  </span>
                  {b}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="ov-section">
          <SectionHead n="04" title="Safety model">
            Probe Mode touches real networks, so it is fenced in.
          </SectionHead>
          <ul className="ov-safety">
            {SAFETY.map(([k, d]) => (
              <li key={k}>
                <span className="ov-safety-k mono">{k}</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ov-final">
          <div>
            <div className="ov-final-title">Watch a probe change the ranking</div>
            <div className="ov-final-sub">
              case-c ships a stale database IP. Run it, press <kbd>P</kbd>, and see the evidence move the confidences.
            </div>
          </div>
          <div className="ov-cta">
            <Link className="btn btn-primary btn-md" to="/app?case=case-c">
              Run case-c
            </Link>
            <Link className="btn btn-ghost btn-md" to="/how-it-works">
              How it works
            </Link>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}

function SectionHead({ n, title, children }) {
  return (
    <header className="ov-section-head">
      <span className="ov-section-n mono">{n}</span>
      <div>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
    </header>
  );
}

function HeroPreview() {
  const ids = Object.keys(EXAMPLES);
  const [id, setId] = useState('case-a');
  const ex = EXAMPLES[id];
  return (
    <div className="ov-preview" aria-label="Example diagnosis">
      <div className="ov-preview-chrome">
        <div className="ov-preview-tabs" role="tablist" aria-label="Sample case">
          {ids.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={c === id} className={`mono ${c === id ? 'on' : ''}`} onClick={() => setId(c)}>
              {c}
            </button>
          ))}
        </div>
        <span className="mono dim ov-preview-label">example output</span>
      </div>
      <div className="ov-preview-log mono">
        <div>
          <span className="dim">14</span> db: attempt 1/5 failed: {ex.driver}
        </div>
        <div className="ov-err-line">
          <span className="dim">19</span> {SYMPTOM}
        </div>
      </div>
      <div className="ov-preview-list">
        {ex.hyps.map((h, i) => (
          <HypothesisCard key={`${id}-${i}`} h={h} rank={i + 1} top={i === 0} compact />
        ))}
      </div>
    </div>
  );
}

function StepIcon({ name }) {
  const p = {
    repo: 'M3 2.5h7l3 3v8H3z M10 2.5v3h3',
    log: 'M2.5 4h11 M2.5 7h8 M2.5 10h11 M2.5 13h6',
    rank: 'M3 13V9 M8 13V5 M13 13V2',
    probe: 'M8 2v3 M8 11v3 M2 8h3 M11 8h3 M8 8m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0',
  }[name];
  return (
    <svg className="ov-step-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={p} />
    </svg>
  );
}
