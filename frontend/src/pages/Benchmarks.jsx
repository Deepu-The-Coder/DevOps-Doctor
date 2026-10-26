import { useEffect, useState } from 'react';
import { EmptyState } from '../components/ui.jsx';
import './Benchmarks.css';

const MODE_LABEL = { full: 'Full context', 'logs-only': 'Logs only', 'full+probe': 'Full + probes' };
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const secs = (ms) => (ms == null ? '–' : `${(ms / 1000).toFixed(1)}s`);

// Accuracy over all cases: a provider error or timeout counts as a miss, as it would for a user.
function summarize(run) {
  const ok = run.cases.filter((c) => !c.error);
  const correct = ok.filter((c) => c.top1_correct).length;
  return {
    correct,
    completed: ok.length,
    errors: run.cases.length - ok.length,
    total: run.cases.length,
    accuracy: run.cases.length ? correct / run.cases.length : 0,
    avg_time_ms: ok.length ? Math.round(ok.reduce((a, c) => a + c.time_ms, 0) / ok.length) : null,
    false_positives: ok.reduce((a, c) => a + c.false_positives, 0),
  };
}

export default function Benchmarks() {
  const [data, setData] = useState(undefined); // undefined = loading, null = missing
  const [mode, setMode] = useState('full');

  useEffect(() => {
    fetch('/eval-results.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setData(j && Array.isArray(j.runs) ? j : null);
        if (j?.runs?.length && !j.runs.find((r) => r.mode === 'full')) setMode(j.runs[0].mode);
      })
      .catch(() => setData(null));
  }, []);

  if (data === undefined) return <div className="bench-page" />;

  if (data === null)
    return (
      <div className="bench-page">
        <Header />
        <EmptyState title="No eval results yet">
          Start the backend, then from the repo root run:
          <pre className="cmd mono">node scripts/eval.js</pre>
          It runs the 4 sample cases in each mode and writes <span className="mono">frontend/public/eval-results.json</span>.
        </EmptyState>
      </div>
    );

  const run = data.runs.find((r) => r.mode === mode) || data.runs[0];
  const t = summarize(run);

  return (
    <div className="bench-page">
      <Header />
      <p className="bench-meta mono">
        model {data.model || 'unknown'} · generated {new Date(data.generated_at).toLocaleString()} · false positive = wrong
        hypothesis with confidence ≥ {data.fp_threshold ?? 0.5}
      </p>
      <div className="note warn honest">
        {run.cases.length} hand-built cases, one run each. Small sample; directional, not statistically significant. API
        errors and timeouts count as misses.
      </div>

      <div className="segmented bench-modes" role="radiogroup" aria-label="Mode">
        {data.runs.map((r) => (
          <button key={r.mode} type="button" role="radio" aria-checked={r.mode === run.mode} className={r.mode === run.mode ? 'on' : ''} onClick={() => setMode(r.mode)}>
            {MODE_LABEL[r.mode] || r.mode}
          </button>
        ))}
      </div>

      <div className="stats">
        <Stat
          label="Top-1 accuracy"
          value={t.total ? pct(t.accuracy) : '–'}
          sub={`${t.correct} of ${t.total} cases${t.errors ? ` · ${t.errors} errored, counted as misses` : ''}`}
        />
        <Stat label="Avg time to diagnosis" value={secs(t.avg_time_ms)} sub="per completed case, wall clock" />
        <Stat label="False positives" value={String(t.false_positives)} sub="across completed cases" />
      </div>

      <section className="bench-section">
        <h2 className="section-label">Top-1 accuracy by mode</h2>
        <AccuracyBars runs={data.runs} active={run.mode} />
      </section>

      <section className="bench-section">
        <h2 className="section-label">Per case · {MODE_LABEL[run.mode] || run.mode}</h2>
        <div className="bench-table-wrap">
        <table className="bench-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Top-1</th>
              <th className="num">Correct rank</th>
              <th className="num">False +</th>
              <th className="num">Time</th>
              <th>Model's #1</th>
            </tr>
          </thead>
          <tbody>
            {run.cases.map((c) => (
              <tr key={c.case}>
                <td className="mono">{c.case}</td>
                <td className={c.error ? 'warn' : c.top1_correct ? 'ok' : 'bad'}>{c.error ? '! error' : c.top1_correct ? '✓ correct' : '✗ wrong'}</td>
                <td className="mono num">{c.error ? '' : c.correct_rank ?? 'not found'}</td>
                <td className="mono num">{c.error ? '' : c.false_positives}</td>
                <td className="mono num">
                  {secs(c.time_ms)}
                  {c.cached && <span className="dim"> cached</span>}
                </td>
                <td className="title-cell">{c.error ? <span className="mono bad">{c.error}</span> : c.top1_title}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="bench-head">
      <h1>Benchmarks</h1>
      <p>Does reading the repo help? The same 4 failures, diagnosed with repo + logs, logs only, and repo + logs + probes.</p>
    </header>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="section-label">{label}</div>
      <div className="stat-value mono">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

// Plain SVG horizontal bars, one series (accuracy), labelled directly.
function AccuracyBars({ runs, active }) {
  const [hover, setHover] = useState(null);
  const rowH = 28;
  const labelW = 120;
  const width = 560;
  const barMax = width - labelW - 60;
  const h = runs.length * rowH + 24;
  return (
    <div className="bars-wrap">
      <svg className="bars" viewBox={`0 0 ${width} ${h}`} width="100%" role="img" aria-label="Top-1 accuracy by mode">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={labelW + t * barMax} x2={labelW + t * barMax} y1={0} y2={h - 18} className="grid" />
            <text x={labelW + t * barMax} y={h - 4} className="axis" textAnchor="middle">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {runs.map((r, i) => {
          const y = i * rowH + 6;
          const t = summarize(r);
          const w = Math.max(t.accuracy * barMax, 2);
          const correct = t.correct;
          return (
            <g
              key={r.mode}
              onMouseEnter={() => setHover({ r, correct, total: t.total, errors: t.errors, y })}
              onMouseLeave={() => setHover(null)}
            >
              <rect x={0} y={y - 4} width={width} height={rowH} className="hit" />
              <text x={labelW - 10} y={y + 11} className={`blabel ${r.mode === active ? 'active' : ''}`} textAnchor="end">
                {MODE_LABEL[r.mode] || r.mode}
              </text>
              <rect x={labelW} y={y + 2} width={w} height={12} rx={4} className={`bar ${r.mode === active ? 'active' : ''}`} />
              <text x={labelW + w + 8} y={y + 12} className="bval">
                {t.total ? `${pct(t.accuracy)} (${t.correct}/${t.total})` : 'no data'}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="bars-tip mono" style={{ top: hover.y }}>
          {MODE_LABEL[hover.r.mode] || hover.r.mode}: {hover.correct}/{hover.total} correct{hover.errors ? ` · ${hover.errors} errored (counted as misses)` : ''}
        </div>
      )}
    </div>
  );
}
