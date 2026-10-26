import { useState } from 'react';
import * as api from '../api.js';
import { applyPatch, diffText } from '../lib/patch.js';
import { Button, useOutsideClose } from './ui.jsx';

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'fix';

const DIRECT_KEY = 'dd-commit-direct';
const readDirect = () => {
  try {
    return localStorage.getItem(DIRECT_KEY) === '1';
  } catch {
    return false;
  }
};

// One-click commit of a hypothesis' patch: load the real file, apply, push.
// Falls back to the full editor (onNeedsEdit) when the patch doesn't apply cleanly.
export default function QuickCommit({ repoUrl, branch, hypothesis, rank, label = 'Commit fix', size = 'sm', variant = 'primary', onNeedsEdit }) {
  const [open, setOpen] = useState(false);
  const [direct, setDirect] = useState(readDirect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const ref = useOutsideClose(open && !busy, () => setOpen(false));
  const patch = hypothesis?.patch;

  const setDirectPref = (v) => {
    setDirect(v);
    try {
      localStorage.setItem(DIRECT_KEY, v ? '1' : '0');
    } catch {
      // per-viewer preference only
    }
  };

  const push = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const file = await api.readFile({ repoUrl, branch, path: patch.path });
      const applied = applyPatch(file.content, patch.diff);
      if (applied.failed > 0 || !diffText(file.content, applied.content, patch.path)) {
        setOpen(false);
        onNeedsEdit?.(hypothesis);
        return;
      }
      if (/\[REDACTED[A-Z_]*\]/.test(applied.content)) {
        setOpen(false);
        onNeedsEdit?.(hypothesis);
        return;
      }
      const r = await api.commitFile({
        repoUrl,
        branch,
        path: patch.path,
        content: applied.content,
        sha: file.sha,
        message: `fix: ${hypothesis.title}`.slice(0, 72),
        newBranch: direct ? '' : `devopsdoctor/${slug(hypothesis.title)}`,
        openPr: !direct,
        prBody: `**${hypothesis.title}** (${hypothesis.category}, ${Math.round(hypothesis.confidence * 100)}% confidence)\n\n${hypothesis.reasoning || ''}\n\nCommitted from DevOpsDoctor.`,
      });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!patch) return null;

  return (
    <div className="popover-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <Button size={size} variant={variant} onClick={() => setOpen((o) => !o)} title={`Commit the fix for #${rank} to GitHub`}>
        {label}
      </Button>
      {open && (
        <div className="popover qc-pop" role="dialog" aria-label="Commit fix">
          {result ? (
            <>
              <div className="qc-title ok">Pushed to {result.branch}</div>
              <div className="mono commit-links">
                {result.commit_url && (
                  <a href={result.commit_url} target="_blank" rel="noreferrer">
                    commit {String(result.commit_sha).slice(0, 7)}
                  </a>
                )}
                {result.pr_url && (
                  <a href={result.pr_url} target="_blank" rel="noreferrer">
                    pull request
                  </a>
                )}
                {result.file_url && (
                  <a href={result.file_url} target="_blank" rel="noreferrer">
                    file
                  </a>
                )}
              </div>
              {result.pr_note && <div className="warn qc-small">{result.pr_note}</div>}
            </>
          ) : (
            <>
              <div className="qc-title">
                Fix #{rank}: <span className="mono">{patch.path}</span>
              </div>
              <div className="qc-small">{hypothesis.title}</div>
              <div className="commit-radio qc-dest">
                <label>
                  <input type="radio" checked={!direct} onChange={() => setDirectPref(false)} /> new branch + pull request
                </label>
                <label>
                  <input type="radio" checked={direct} onChange={() => setDirectPref(true)} /> push to <span className="mono">{branch}</span>
                </label>
              </div>
              {error && <div className="note bad qc-small">{error}</div>}
              <div className="qc-actions">
                <button type="button" className="link-btn" onClick={() => (setOpen(false), onNeedsEdit?.(hypothesis))}>
                  review first
                </button>
                <Button size="sm" variant="primary" onClick={push} disabled={busy}>
                  {busy ? 'Pushing…' : 'Push'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
