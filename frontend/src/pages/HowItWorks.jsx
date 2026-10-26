import { Link } from 'react-router-dom';
import Footer from '../components/Footer.jsx';
import './HowItWorks.css';

const SCHEMA = `{
  "summary": "one sentence: what failed and the most likely reason",
  "hypotheses": [
    {
      "id": "h1",
      "title": "short root-cause statement",
      "category": "network | env | config | code | platform | dependency",
      "confidence": 0.0,
      "reasoning": "2-3 sentences linking the evidence",
      "evidence": [
        { "type": "file", "path": "src/config.js", "line": 4, "quote": "exact text" },
        { "type": "log",  "line": 14, "quote": "exact text" }
      ],
      "rule_out": "a concrete check that would eliminate this hypothesis",
      "patch": { "path": "src/config.js", "diff": "unified diff" }
    }
  ]
}`;

const API = [
  {
    method: 'POST',
    path: '/api/ingest',
    does: 'Reads the repo (or a subfolder) from GitHub and returns the redacted files the model will see.',
    req: `{ "repoUrl": "https://github.com/owner/repo/tree/main/sample-app/case-a",
  "branch": "main" }`,
    res: `{ "repo": { "owner": "owner", "repo": "repo", "branch": "main", "path": "sample-app/case-a" },
  "sha": "4f1c…",
  "files": [ { "path": "src/config.js", "lines": 8, "content": "…" } ],
  "skipped": 0, "redactions": 1, "time_ms": 812 }`,
  },
  {
    method: 'POST',
    path: '/api/diagnose',
    does: 'Repo + logs → 3–5 ranked hypotheses with verified evidence. mode is "full" or "logs-only".',
    req: `{ "repoUrl": "…", "branch": "main",
  "logs": "<deployment log text>", "mode": "full" }`,
    res: `{ "diagnosis": { "summary": "…", "hypotheses": [ … ] },
  "meta": { "model": "gemma-4-26b-a4b-it", "mode": "full", "cached": false,
            "time_ms": 64210, "files_sent": 7, "log_lines": 23, "redactions": 1 } }`,
  },
  {
    method: 'POST',
    path: '/api/probe',
    does: 'Runs the probe loop and streams NDJSON events so the UI can show it live.',
    req: `{ "repoUrl": "…", "branch": "main", "logs": "…",
  "hypotheses": [ …from /api/diagnose… ] }`,
    res: `{"type":"round","round":1}
{"type":"probe_start","tool":"tcp_connect","args":{"host":"203.0.113.24","port":5432},"reason":"…"}
{"type":"probe_result","tool":"tcp_connect","status":"timeout","ok":false,"detail":"no response in 4s","ms":4004}
{"type":"rerank","round":1,"hypotheses":[…],"changes":[{"id":"h2","from":0.4,"to":0.75,"rank_from":2,"rank_to":1}]}
{"type":"done","rounds":1,"hypotheses":[…]}`,
  },
];

export default function HowItWorks() {
  return (
    <div className="hiw-page">
      <article className="hiw">
        <header>
          <h1>How it works</h1>
          <p>
            DevOpsDoctor puts the repository and the deployment log in front of the model together, asks for a ranked
            differential instead of a single answer, and checks every reference it returns against the real files.
          </p>
        </header>

        <figure className="arch">
          <Architecture />
          <figcaption className="mono">Request path. Dashed boxes run only in Probe Mode.</figcaption>
        </figure>

        <section>
          <h2>1. Case file</h2>
          <ul>
            <li>
              One GitHub tree call lists the repo (or a <span className="mono">/tree/&lt;branch&gt;/&lt;path&gt;</span>{' '}
              subfolder). Up to 40 text files / 120 KB are fetched, ranked by how often they cause deploy failures:
              deploy config (<span className="mono">docker-compose.yml</span>, <span className="mono">fly.toml</span>, k8s
              manifests…), then <span className="mono">Dockerfile</span>, dependency manifests,{' '}
              <span className="mono">.env.example</span>, config modules, then source.
            </li>
            <li>
              Real <span className="mono">.env</span> files are never read. Secrets in the remaining files and in the log
              (URL passwords, <span className="mono">*_TOKEN</span>/<span className="mono">*_SECRET</span>/
              <span className="mono">*_PASSWORD</span> values, GitHub/AWS/API keys, private keys) are masked in place, so
              line numbers don't move.
            </li>
            <li>
              Files are sent with line numbers (<span className="mono">12| code</span>) and the log with its own (
              <span className="mono">L12| text</span>). Logs over 400 lines keep error-like lines plus the last 150, with
              original numbering.
            </li>
          </ul>
        </section>

        <section>
          <h2>2. Diagnosis schema</h2>
          <p>The model must answer with JSON only. Reasoning text and code fences around it are stripped.</p>
          <pre className="code-block mono">{SCHEMA}</pre>
        </section>

        <section>
          <h2>3. Evidence verification</h2>
          <ul>
            <li>Every file ref is checked: the path must be in the case file and the line must exist.</li>
            <li>If the line number is off but the quoted text appears on another line, the ref is moved to that line.</li>
            <li>
              Refs that don't exist are dropped and shown on the card as <span className="mono warn-text">N refs dropped</span>{' '}
              so a hallucinated citation is visible, not hidden.
            </li>
            <li>A patch against a path that isn't in the repo is kept but flagged "path not in repo".</li>
          </ul>
        </section>

        <section>
          <h2>4. Probe loop</h2>
          <ol>
            <li>The model reads the case file and current ranking, and asks for up to 4 probes.</li>
            <li>The backend runs them and returns results; the model re-ranks and may ask for more.</li>
            <li>Stops when the model says more probes won't change the ranking, or after 3 rounds.</li>
          </ol>
          <table className="tools">
            <thead>
              <tr>
                <th>Tool</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="mono">dns_lookup</td><td>Resolves a hostname.</td></tr>
              <tr><td className="mono">tcp_connect</td><td>Opens a TCP connection; reports open, refused or timeout (4 s).</td></tr>
              <tr><td className="mono">http_get</td><td>GET with no redirects; status code and first 300 bytes.</td></tr>
              <tr><td className="mono">read_file</td><td>Reads a repo file that wasn't in the initial case file.</td></tr>
            </tbody>
          </table>
          <h3>Safety model</h3>
          <ul>
            <li>Only the 4 tools above exist. Nothing executes shell commands, writes files, or applies patches.</li>
            <li>Network probes only reach hosts or IPs that literally appear in the repo files or the log.</li>
            <li>Private, loopback, link-local, CGNAT and multicast addresses are refused, including after DNS resolution.</li>
            <li>Secrets are masked before anything is sent to the model.</li>
          </ul>
        </section>

        <section>
          <h2>5. API</h2>
          {API.map((e) => (
            <div className="endpoint" key={e.path}>
              <div className="ep-head">
                <span className="mono method">{e.method}</span>
                <span className="mono">{e.path}</span>
              </div>
              <p>{e.does}</p>
              <div className="ep-grid">
                <div>
                  <div className="section-label">Request</div>
                  <pre className="code-block mono">{e.req}</pre>
                </div>
                <div>
                  <div className="section-label">Response</div>
                  <pre className="code-block mono">{e.res}</pre>
                </div>
              </div>
            </div>
          ))}
          <p>
            Try it on a known failure from the <Link to="/cases">case library</Link>, or see measured accuracy on{' '}
            <Link to="/benchmarks">Benchmarks</Link>.
          </p>
        </section>
      </article>
      <Footer />
    </div>
  );
}

function Box({ x, y, w, h, title, sub, dashed, accent }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} className={`node ${dashed ? 'dashed' : ''} ${accent ? 'accent' : ''}`} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 3 : h / 2 + 4)} className="ntitle" textAnchor="middle">
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 13} className="nsub" textAnchor="middle">
          {sub}
        </text>
      )}
    </g>
  );
}

function Arrow({ d, label, lx, ly, dashed }) {
  return (
    <g>
      <path d={d} className={`edge ${dashed ? 'dashed' : ''}`} markerEnd="url(#arrow)" />
      {label && (
        <text x={lx} y={ly} className="elabel" textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}

function Architecture() {
  return (
    <svg viewBox="0 0 760 300" width="100%" role="img" aria-label="Architecture: React frontend calls Express backend, which reads GitHub, calls Gemma 4, and runs allowlisted probes">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="arrowhead" />
        </marker>
      </defs>

      <Box x={10} y={110} w={150} h={56} title="React frontend" sub="/app · /cases" />
      <Box x={250} y={110} w={170} h={56} title="Express backend" sub="redact · verify" accent />
      <Box x={530} y={20} w={210} h={50} title="GitHub API" sub="tree + raw files" />
      <Box x={530} y={110} w={210} h={56} title="Gemma 4" sub="Google AI Studio" />

      <g>
        <rect x={250} y={210} width={490} height={80} rx={6} className="node dashed" />
        <text x={262} y={228} className="nsub start">Probes (read-only allowlist, max 3 rounds)</text>
        {['dns_lookup', 'tcp_connect', 'http_get', 'read_file'].map((t, i) => (
          <g key={t}>
            <rect x={262 + i * 118} y={240} width={108} height={36} rx={4} className="tool" />
            <text x={262 + i * 118 + 54} y={262} className="ttext" textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
      </g>

      <Arrow d="M160,138 L246,138" label="HTTP / NDJSON" lx={203} ly={130} />
      <Arrow d="M420,128 C470,128 480,45 526,45" label="read repo" lx={478} ly={70} />
      <Arrow d="M420,138 L526,138" label="case file" lx={473} ly={131} />
      <Arrow d="M335,166 L335,206" label="probe mode" lx={378} ly={192} dashed />
    </svg>
  );
}
