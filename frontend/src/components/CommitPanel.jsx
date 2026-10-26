import { useEffect, useMemo, useState } from 'react';
import * as api from '../api.js';
import { applyPatch, diffText } from '../lib/patch.js';
import { DiffViewer } from './viewers.jsx';
import { Button } from './ui.jsx';

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'patch';

// Review a suggested patch against the real file, edit it, then commit to GitHub.
export default function CommitPanel({ repoUrl, branch, patch, hypothesis, onClose }) {
  const [file, setFile] = useState(null); // { content, sha, exists, full_path }
  const [loadError, setLoadError] = useState('');
  const [content, setContent] = useState('');
  const [applyInfo, setApplyInfo] = useState(null);
  const [message, setMessage] = useState(`fix: ${hypothesis.title}`.slice(0, 72));
  const [mode, setMode] = useState('new'); // 'new' branch or 'current'
  const [newBranch, setNewBranch] = useState(`devopsdoctor/${slug(hypothesis.title)}`);
  const [openPr, setOpenPr] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .readFile({ repoUrl, branch, path: patch.path })
      .then((f) => {
        if (!alive) return;
        setFile(f);
        const r = applyPatch(f.content, patch.diff);
        setApplyInfo(r);
        setContent(r.content);
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [repoUrl, branch, patch.path, patch.diff]);

  const preview = useMemo(() => (file ? diffText(file.content, content, patch.path) : ''), [file, content, patch.path]);
  const redacted = /\[REDACTED[A-Z_]*\]/.test(content);

  const commit = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.commitFile({
        repoUrl,
        branch,
        path: patch.path,
        content,
        sha: file.sha,
        message,
        newBranch: mode === 'new' ? newBranch : '',
        openPr: mode === 'new' && openPr,
        prBody: `**${hypothesis.title}** (${hypothesis.category}, ${Math.round(hypothesis.confidence * 100)}% confidence)\n\n${hypothesis.reasoning || ''}\n\nSuggested by DevOpsDoctor and reviewed before committing.`,
      });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (result)
    return (
      <div className="commit-panel">
        <div className="note ok-note">
          <div className="commit-done-title">Committed to {result.branch}</div>
          <div className="mono commit-links">
            {result.commit_url && (
              <a href={result.commit_url} target="_blank" rel="noreferrer">
                commit {String(result.commit_sha).slice(0, 7)}
              </a>
            )}
            {result.file_url && (
              <a href={result.file_url} target="_blank" rel="noreferrer">
                view file
              </a>
            )}
            {result.pr_url && (
              <a href={result.pr_url} target="_blank" rel="noreferrer">
                pull request
              </a>
            )}
          </div>
          {result.pr_note && <div className="warn">{result.pr_note}</div>}
        </div>
        <Button size="sm" onClick={onClose}>
          Back to patch
        </Button>
      </div>
    );

  return (
    <div className="commit-panel">
      <div className="commit-head">
        <span className="mono">{patch.path}</span>
        {applyInfo &&
          (applyInfo.failed === 0 ? (
            <span className="ok mono">patch applied</span>
          ) : (
            <span className="warn mono">
              {applyInfo.failed}/{applyInfo.total} hunk{applyInfo.total > 1 ? 's' : ''} didn't apply; edit below
            </span>
          ))}
        {file && !file.exists && <span className="warn mono">new file</span>}
      </div>

      {loadError && <div className="note bad">{loadError}</div>}
      {!file && !loadError && <div className="dim mono">loading {patch.path} from GitHub…</div>}

      {file && (
        <>
          <label className="field">
            <span className="section-label">File after change (editable)</span>
            <textarea className="input mono commit-editor" value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} />
          </label>
          {redacted && <div className="note bad">This file contains a [REDACTED] placeholder. Put the real value back before committing.</div>}

          <div className="field">
            <span className="section-label">What will change</span>
            {preview ? <DiffViewer diff={preview} /> : <div className="dim mono">no changes yet</div>}
          </div>

          <label className="field">
            <span className="section-label">Commit message</span>
            <input className="input mono" value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>

          <div className="field">
            <span className="section-label">Commit to</span>
            <div className="commit-radio">
              <label>
                <input type="radio" name="dest" checked={mode === 'new'} onChange={() => setMode('new')} /> new branch
              </label>
              <label>
                <input type="radio" name="dest" checked={mode === 'current'} onChange={() => setMode('current')} /> <span className="mono">{branch}</span>{' '}
                directly
              </label>
            </div>
            {mode === 'new' && (
              <>
                <input className="input mono" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} aria-label="New branch name" />
                <label className="commit-check">
                  <input type="checkbox" checked={openPr} onChange={(e) => setOpenPr(e.target.checked)} /> open a pull request into{' '}
                  <span className="mono">{branch}</span>
                </label>
              </>
            )}
          </div>

          {error && <div className="note bad">{error}</div>}
          <div className="commit-actions">
            <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={commit} disabled={busy || !preview || redacted || !message.trim()}>
              {busy ? 'Committing…' : mode === 'new' ? 'Commit to new branch' : `Commit to ${branch}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
