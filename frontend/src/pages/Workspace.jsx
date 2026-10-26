import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '../api.js';
import { getCase } from '../data/cases.js';
import { isTypingTarget } from '../theme/theme.js';
import HypothesisCard from '../components/HypothesisCard.jsx';
import ProbeTimeline from '../components/ProbeTimeline.jsx';
import ShortcutsPopover from '../components/ShortcutsPopover.jsx';
import { CodeViewer, DiffViewer, LogViewer } from '../components/viewers.jsx';
import { Button, EmptyState, Skeleton, Tabs } from '../components/ui.jsx';
import './Workspace.css';

const PHASE_BADGE = {
  idle: ['NO RUN', ''],
  ingesting: ['INGESTING', 'busy'],
  diagnosing: ['DIAGNOSING', 'busy'],
  done: ['DIAGNOSED', 'ok'],
  error: ['ERROR', 'bad'],
};

function repoLabel(url, branch) {
  const m = String(url).match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/[^/]+\/(.+))?\/?$/);
  if (!m) return null;
  return { repo: `${m[1]}/${m[2]}`, branch: branch || 'main', path: m[3] || '' };
}

export default function Workspace() {
  const [params] = useSearchParams();
  const caseId = params.get('case');

  // Inputs
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [mode, setMode] = useState('full');
  const [logs, setLogs] = useState('');
  const [editingLogs, setEditingLogs] = useState(true);
  const [caseNote, setCaseNote] = useState('');

  // Run state
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [ingestData, setIngestData] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [meta, setMeta] = useState(null);
  const [deltas, setDeltas] = useState({});
  const [probeEvents, setProbeEvents] = useState([]);
  const [probing, setProbing] = useState(false);
  const [engine, setEngine] = useState(null);

  // View state
  const [tab, setTab] = useState('files');
  const [file, setFile] = useState(null); // { path, line }
  const [logFocus, setLogFocus] = useState(null);
  const [selected, setSelected] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pane, setPane] = useState('case'); // which column shows on narrow screens

  const abortRef = useRef(null);
  const cardRefs = useRef([]);

  useEffect(() => {
    api.health().then(setEngine).catch(() => setEngine({ offline: true }));
  }, []);

  const resetRun = () => {
    abortRef.current?.abort();
    setPhase('idle');
    setError('');
    setIngestData(null);
    setDiagnosis(null);
    setMeta(null);
    setDeltas({});
    setProbeEvents([]);
    setProbing(false);
    setFile(null);
    setLogFocus(null);
    setSelected(0);
  };

  // Deep link: /app?case=case-c preloads repo, branch and that case's log.
  useEffect(() => {
    if (!caseId) return;
    const c = getCase(caseId);
    resetRun();
    if (!c) {
      setCaseNote(`Unknown case "${caseId}".`);
      return;
    }
    setCaseNote('');
    setRepoUrl(c.repoUrl);
    setBranch(c.branch);
    setMode('full');
    fetch(c.log)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
      .then((t) => {
        setLogs(t);
        setEditingLogs(false);
      })
      .catch(() => setCaseNote(`Could not load ${c.log}.`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const logLines = useMemo(() => {
    const l = logs.replace(/\r\n/g, '\n').split('\n');
    while (l.length && l[l.length - 1] === '') l.pop();
    return l;
  }, [logs]);

  const hyps = diagnosis?.hypotheses || [];

  const openEvidence = useCallback((ev) => {
    if (ev.type === 'log') {
      setEditingLogs(false);
      setLogFocus(ev.line);
      setPane('case');
    } else {
      setFile({ path: ev.path, line: ev.line });
      setTab('files');
      setPane('evidence');
    }
  }, []);

  const run = useCallback(async () => {
    if (phase === 'ingesting' || phase === 'diagnosing') return;
    if (!repoUrl.trim() || !logs.trim()) {
      setPhase('error');
      setError(!repoUrl.trim() ? 'Enter a GitHub repository URL.' : 'Paste the deployment logs.');
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError('');
    setDiagnosis(null);
    setMeta(null);
    setDeltas({});
    setProbeEvents([]);
    setSelected(0);
    setEditingLogs(false);
    try {
      setPhase('ingesting');
      setPane('diagnosis');
      const ing = await api.ingest({ repoUrl, branch }, ctrl.signal);
      setIngestData(ing);
      setPhase('diagnosing');
      const res = await api.diagnose({ repoUrl, branch, logs, mode }, ctrl.signal);
      setDiagnosis(res.diagnosis);
      setMeta(res.meta);
      setPhase('done');
      const firstFile = res.diagnosis.hypotheses[0]?.evidence.find((e) => e.type === 'file');
      if (firstFile) setFile({ path: firstFile.path, line: firstFile.line });
      else if (ing.files[0]) setFile({ path: ing.files[0].path, line: null });
      const firstLog = res.diagnosis.hypotheses[0]?.evidence.find((e) => e.type === 'log');
      if (firstLog) setLogFocus(firstLog.line);
      setTab('files');
    } catch (err) {
      if (err.name === 'AbortError') return;
      setPhase('error');
      setError(err.message);
    }
  }, [phase, repoUrl, branch, logs, mode]);

  const runProbes = useCallback(async () => {
    if (!hyps.length || probing) return;
    setTab('probes');
    setPane('evidence');
    setProbing(true);
    setProbeEvents([]);
    try {
      await api.probe({ repoUrl, branch, logs, hypotheses: hyps }, (ev) => {
        setProbeEvents((prev) => [...prev, ev]);
        if (ev.type === 'rerank') {
          setDeltas(Object.fromEntries(ev.changes.map((c) => [c.id, c])));
          setDiagnosis((d) => ({ ...d, hypotheses: ev.hypotheses }));
        }
      });
    } catch (err) {
      setProbeEvents((prev) => [...prev, { type: 'error', message: err.message }]);
    } finally {
      setProbing(false);
    }
  }, [hyps, probing, repoUrl, branch, logs]);

  // Keyboard shortcuts. Refs keep the handler pointed at the latest callbacks.
  const handlers = useRef({});
  handlers.current = { run, runProbes };
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handlers.current.run();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(document.activeElement)) return;
      if (e.key === '?') return void setShortcutsOpen((o) => !o);
      if (e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === 'p') handlers.current.runProbes();
      else if (k === 'f') setTab('files');
      else if (k === 'r') setTab('probes');
      else if (k === 'd') setTab('patch');
      else if (/^[1-5]$/.test(k)) cardRefs.current[Number(k) - 1]?.focus();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lines cited by any hypothesis, for highlighting in the viewers.
  const citedFileLines = useMemo(() => {
    const s = new Set();
    for (const h of hyps) for (const e of h.evidence) if (e.type === 'file' && e.path === file?.path) s.add(e.line);
    return s;
  }, [hyps, file?.path]);
  const citedLogLines = useMemo(() => {
    const s = new Set();
    for (const h of hyps) for (const e of h.evidence) if (e.type === 'log') s.add(e.line);
    return s;
  }, [hyps]);

  const currentFile = ingestData?.files.find((f) => f.path === file?.path) || null;
  const selHyp = hyps[selected] || null;
  const patchHyp = selHyp?.patch ? selHyp : hyps.find((h) => h.patch) || null;
  const busy = phase === 'ingesting' || phase === 'diagnosing';
  const elapsed = useElapsed(busy || probing);
  const label = repoLabel(repoUrl, branch);
  const [badge, badgeCls] = PHASE_BADGE[phase];

  const engineState = engine?.offline ? 'bad' : busy || probing ? 'busy' : 'ok';
  const engineText = engine?.offline ? 'backend offline' : busy ? 'engine: running' : probing ? 'engine: probing' : 'engine: idle';

  return (
    <div className="ws">
      {/* Toolbar */}
      <div className="ws-toolbar">
        <div className="ws-crumb mono">
          {label ? (
            <>
              <span className="muted">{label.repo}</span>
              <span className="dim">@</span>
              <span>{label.branch}</span>
              {label.path && <span className="dim">/{label.path}</span>}
            </>
          ) : (
            <span className="dim">no repository</span>
          )}
        </div>
        <span className={`badge mono ${badgeCls}`}>{badge}</span>
        {caseId && <span className="badge mono">{caseId}</span>}
        <div className="ws-toolbar-right">
          <span className="engine mono">
            <span className={`dot ${engineState}`} />
            {engineText}
          </span>
          <Button size="sm" onClick={runProbes} disabled={!hyps.length || probing || busy} title="Run probes (P)">
            {probing ? `Probing… ${elapsed}s` : 'Run probes'}
          </Button>
          <ShortcutsPopover open={shortcutsOpen} setOpen={setShortcutsOpen} />
        </div>
      </div>

      <div className="ws-panes segmented" role="tablist" aria-label="Workspace panel">
        {[
          ['case', 'Case'],
          ['diagnosis', hyps.length ? `Diagnosis (${hyps.length})` : 'Diagnosis'],
          ['evidence', 'Evidence'],
        ].map(([id, t]) => (
          <button key={id} type="button" role="tab" aria-selected={pane === id} className={pane === id ? 'on' : ''} onClick={() => setPane(id)}>
            {t}
          </button>
        ))}
      </div>

      <div className={`ws-cols pane-${pane}`}>
        {/* LEFT: case setup */}
        <aside className="ws-left">
          <div className="col-head">
            <span className="section-label">Case setup</span>
            {caseId && <span className="mono dim">{caseId}</span>}
          </div>
          <div className="ws-form">
            {caseNote && <div className="note bad">{caseNote}</div>}
            <label className="field">
              <span className="section-label">Repository URL</span>
              <input
                className="input mono"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span className="section-label">Branch</span>
              <input className="input mono" value={branch} onChange={(e) => setBranch(e.target.value)} spellCheck={false} />
            </label>
            <div className="field">
              <span className="section-label">Analysis scope</span>
              <div className="segmented" role="radiogroup" aria-label="Analysis scope">
                {[
                  ['full', 'Full context'],
                  ['logs-only', 'Logs only'],
                ].map(([v, t]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={mode === v}
                    className={mode === v ? 'on' : ''}
                    onClick={() => setMode(v)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="field grow">
              <div className="field-head">
                <span className="section-label">Deployment log</span>
                <span className="mono dim">
                  {logLines.length} lines
                  {logs && (
                    <button type="button" className="link-btn" onClick={() => setEditingLogs((v) => !v)} style={{ marginLeft: 8 }}>
                      {editingLogs ? 'view' : 'edit'}
                    </button>
                  )}
                </span>
              </div>
              {editingLogs || !logs ? (
                <textarea
                  className="input mono log-input"
                  value={logs}
                  onChange={(e) => setLogs(e.target.value)}
                  placeholder="Paste the failed deployment's logs here"
                  spellCheck={false}
                />
              ) : (
                <LogViewer lines={logLines} focusLine={logFocus} citedLines={citedLogLines} />
              )}
            </div>
            <Button variant="primary" onClick={run} disabled={busy} title="Run diagnosis (Ctrl/⌘+Enter)">
              {busy ? (phase === 'ingesting' ? 'Reading repo…' : 'Diagnosing…') : 'Run diagnosis'}
              <kbd className="btn-kbd">Ctrl ↵</kbd>
            </Button>
          </div>
        </aside>

        {/* CENTER: differential */}
        <section className="ws-center">
          <div className="col-head">
            <span className="section-label">Differential diagnosis</span>
            {hyps.length > 0 && <span className="count mono">{hyps.length} hypotheses</span>}
            <span className="mono dim col-head-right">{hyps.length > 0 && 'sorted by confidence ↓'}</span>
          </div>
          <div className="ws-list">
            {meta?.cached && (
              <div className="note warn">
                Model call failed ({meta.cache_reason}). Showing the last good run from{' '}
                <span className="mono">{new Date(meta.generated_at).toLocaleString()}</span>.
              </div>
            )}
            {meta?.mock && <div className="note warn">Mock model (LLM_MOCK=1). These results are placeholders, not a real diagnosis.</div>}

            {phase === 'idle' && (
              <EmptyState title="No diagnosis yet">
                Enter a repo and paste deployment logs, then press <kbd>Ctrl ↵</kbd>. Or{' '}
                <Link to="/cases">open a sample case</Link>.
              </EmptyState>
            )}
            {busy && (
              <>
                <div className="progress mono">
                  {phase === 'ingesting'
                    ? 'Reading repository…'
                    : `Read ${ingestData?.files.length ?? 0} files${ingestData?.redactions ? ` · ${ingestData.redactions} secrets masked` : ''} · model is reasoning…`}
                  <span className="dim"> {elapsed}s</span>
                  {elapsed > 20 && <div className="dim">Gemma thinks before answering; a full diagnosis usually takes 30–90s.</div>}
                </div>
                {[0, 1, 2].map((i) => (
                  <div className="hyp skeleton-card" key={i}>
                    <Skeleton h={14} w="60%" />
                    <Skeleton h={10} w="90%" style={{ marginTop: 10 }} />
                    <Skeleton h={10} w="75%" style={{ marginTop: 6 }} />
                    <Skeleton h={18} w="40%" style={{ marginTop: 12 }} />
                  </div>
                ))}
              </>
            )}
            {phase === 'error' && (
              <div className="error-box">
                <div className="mono">{error}</div>
                <div className="error-actions">
                  <Button size="sm" onClick={run}>
                    Retry
                  </Button>
                  {mode === 'full' && repoUrl && logs && (
                    <Button size="sm" variant="ghost" onClick={() => setMode('logs-only')}>
                      Switch to logs only
                    </Button>
                  )}
                </div>
              </div>
            )}
            {phase === 'done' && diagnosis && (
              <>
                {diagnosis.summary && <p className="summary">{diagnosis.summary}</p>}
                {hyps.length === 0 && <EmptyState title="The model returned no usable hypotheses">Try again or switch scope.</EmptyState>}
                {hyps.map((h, i) => (
                  <HypothesisCard
                    key={h.id}
                    ref={(el) => (cardRefs.current[i] = el)}
                    h={h}
                    rank={i + 1}
                    top={i === 0}
                    selected={i === selected}
                    delta={deltas[h.id]}
                    onSelect={() => setSelected(i)}
                    onEvidence={openEvidence}
                    onShowPatch={() => {
                      setSelected(i);
                      setTab('patch');
                      setPane('evidence');
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </section>

        {/* RIGHT: evidence */}
        <aside className="ws-right">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'files', label: 'Files', key: 'F' },
              { id: 'probes', label: 'Probes', key: 'R', badge: probing ? '…' : null },
              { id: 'patch', label: 'Patch', key: 'D' },
            ]}
            right={tab === 'files' ? currentFile?.path : tab === 'patch' ? patchHyp?.patch?.path : null}
          />
          <div className="ws-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'files' &&
              (ingestData?.files.length ? (
                <>
                  <div className="subbar mono">
                    <select
                      className="file-select mono"
                      value={file?.path || ''}
                      onChange={(e) => setFile({ path: e.target.value, line: null })}
                      aria-label="File"
                    >
                      {!currentFile && <option value="">select a file</option>}
                      {ingestData.files.map((f) => (
                        <option key={f.path} value={f.path}>
                          {f.path}
                        </option>
                      ))}
                    </select>
                    <span className="dim">
                      {citedFileLines.size ? `${citedFileLines.size} line${citedFileLines.size > 1 ? 's' : ''} cited` : `${ingestData.files.length} files`}
                    </span>
                  </div>
                  {currentFile ? (
                    <CodeViewer content={currentFile.content} focusLine={file?.line} citedLines={citedFileLines} />
                  ) : (
                    file?.path && <EmptyState title={`${file.path} was not loaded`}>It may have been fetched by a probe only.</EmptyState>
                  )}
                </>
              ) : (
                <EmptyState title="No files loaded">Run a diagnosis to read the repository. Evidence chips open files here.</EmptyState>
              ))}

            {tab === 'probes' &&
              (probeEvents.length || probing ? (
                <ProbeTimeline events={probeEvents} running={probing} />
              ) : (
                <EmptyState title="No probes run">
                  {hyps.length ? (
                    <>
                      Press <kbd>P</kbd> to let the model order read-only checks (DNS, TCP, HTTP GET, repo file read) and re-rank.
                    </>
                  ) : (
                    'Run a diagnosis first.'
                  )}
                </EmptyState>
              ))}

            {tab === 'patch' &&
              (patchHyp ? (
                <>
                  <div className="subbar mono">
                    <span>
                      for #{hyps.indexOf(patchHyp) + 1} · {patchHyp.patch.path}
                    </span>
                    {!patchHyp.patch.verified && <span className="bad">path not in repo</span>}
                    <CopyButton text={patchHyp.patch.diff} />
                  </div>
                  <DiffViewer diff={patchHyp.patch.diff} />
                  <div className="panel-foot">Suggested only. DevOpsDoctor never applies patches.</div>
                </>
              ) : (
                <EmptyState title="No patch">{hyps.length ? 'No hypothesis suggested a patch.' : 'Run a diagnosis first.'}</EmptyState>
              ))}
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <footer className="statusbar mono">
        <span className="sb-item">
          <span className={`dot ${engineState}`} />
          <span>{meta?.model || engine?.model || 'model unknown'}</span>
          <span className="dim">({meta?.provider || engine?.provider || "no provider"})</span>
        </span>
        {meta && (
          <>
            <span className="sb-item">{(meta.time_ms / 1000).toFixed(1)}s</span>
            <span className="sb-item">{meta.files_sent} files</span>
            <span className="sb-item">{meta.log_lines} log lines</span>
            <span className="sb-item">{meta.mode}</span>
            {meta.redactions > 0 && <span className="sb-item">{meta.redactions} secret{meta.redactions > 1 ? "s" : ""} masked</span>}
            {meta.cached && <span className="sb-item warn">cached run</span>}
          </>
        )}
        <span className="sb-right dim">probes: read-only allowlist</span>
      </footer>
    </div>
  );
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="link-btn"
      style={{ marginLeft: 'auto' }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          // ignore
        }
      }}
    >
      {done ? 'copied' : 'copy diff'}
    </button>
  );
}

// Seconds since `active` became true; resets when it turns false.
function useElapsed(active) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!active) return setS(0);
    const t0 = Date.now();
    const id = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
  return s;
}
