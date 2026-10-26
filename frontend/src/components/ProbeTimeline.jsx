import { Delta } from './ui.jsx';

const STATUS_LABEL = {
  open: 'OPEN',
  refused: 'REFUSED',
  timeout: 'TIMEOUT',
  resolved: 'RESOLVED',
  nxdomain: 'NXDOMAIN',
  read: 'READ',
  not_found: 'NOT FOUND',
  error: 'BLOCKED/ERROR',
  dns_error: 'DNS ERROR',
  http_error: 'HTTP ERROR',
};

function argsText(tool, a = {}) {
  if (tool === 'tcp_connect') return `${a.host}:${a.port}`;
  if (tool === 'dns_lookup') return a.host;
  if (tool === 'http_get') return a.url;
  if (tool === 'read_file') return a.path;
  return JSON.stringify(a);
}

// Renders the probe event stream: rounds, each probe and its result, and re-rank changes.
export default function ProbeTimeline({ events, running }) {
  const items = [];
  const pending = new Map();
  for (const ev of events) {
    if (ev.type === 'round') items.push({ kind: 'round', round: ev.round });
    else if (ev.type === 'probe_start') {
      const item = { kind: 'probe', ...ev, pending: true };
      pending.set(`${ev.round}:${ev.tool}:${JSON.stringify(ev.args)}`, item);
      items.push(item);
    } else if (ev.type === 'probe_result') {
      const item = pending.get(`${ev.round}:${ev.tool}:${JSON.stringify(ev.args)}`);
      if (item) Object.assign(item, ev, { pending: false });
    } else if (ev.type === 'rerank') items.push({ kind: 'rerank', ...ev });
    else if (ev.type === 'error') items.push({ kind: 'error', message: ev.message });
    else if (ev.type === 'done') items.push({ kind: 'done', rounds: ev.rounds });
  }

  if (!items.length && !running) return null;

  return (
    <ol className="timeline">
      {items.map((it, i) => {
        if (it.kind === 'round') return <li key={i} className="tl-round section-label">Round {it.round}</li>;
        if (it.kind === 'probe')
          return (
            <li key={i} className="tl-probe">
              <div className="tl-row">
                <span className="mono tl-tool">{it.tool}</span>
                <span className="mono tl-args">{argsText(it.tool, it.args)}</span>
                <span className={`tl-status mono ${it.pending ? 'pending' : it.ok ? 'ok' : 'bad'}`}>
                  {it.pending ? 'RUNNING' : STATUS_LABEL[it.status] || String(it.status).toUpperCase()}
                </span>
                {!it.pending && <span className="mono tl-ms">{it.ms}ms</span>}
              </div>
              {it.reason && <div className="tl-reason">{it.reason}</div>}
              {!it.pending && it.detail && <pre className="tl-detail mono">{it.detail}</pre>}
            </li>
          );
        if (it.kind === 'rerank')
          return (
            <li key={i} className="tl-rerank">
              <div className="section-label">Re-ranked</div>
              {it.changes.map((c) => (
                <div key={c.id} className="tl-change">
                  <span className="mono tl-rank">
                    #{c.rank_from ?? '–'} → #{c.rank_to}
                  </span>
                  <span className="tl-change-title">{c.title}</span>
                  {c.from == null ? <span className="delta mono up">new {Math.round(c.to * 100)}%</span> : <Delta from={c.from} to={c.to} />}
                </div>
              ))}
            </li>
          );
        if (it.kind === 'error') return <li key={i} className="tl-error mono">error: {it.message}</li>;
        return (
          <li key={i} className="tl-done mono">
            done · {it.rounds} round{it.rounds === 1 ? '' : 's'}
          </li>
        );
      })}
      {running && <li className="tl-running mono">probing…</li>}
    </ol>
  );
}
