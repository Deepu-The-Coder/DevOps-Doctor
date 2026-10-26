import { useEffect, useMemo, useState } from 'react';
import { myRepos } from '../api.js';
import { useOutsideClose } from './ui.jsx';

// "Your repos" dropdown for signed-in users. Calls onPick({ url, branch }).
export default function RepoPicker({ onPick }) {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const ref = useOutsideClose(open, () => setOpen(false));

  useEffect(() => {
    if (!open || repos) return;
    myRepos()
      .then(setRepos)
      .catch((e) => setError(e.message));
  }, [open, repos]);

  const shown = useMemo(
    () => (repos || []).filter((r) => r.full_name.toLowerCase().includes(q.toLowerCase())).slice(0, 50),
    [repos, q]
  );

  return (
    <div className="popover-wrap" ref={ref}>
      <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        your repos ▾
      </button>
      {open && (
        <div className="popover repo-pop" role="dialog" aria-label="Your repositories">
          <input
            className="input mono"
            autoFocus
            placeholder="filter repositories"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="repo-list">
            {error && <div className="bad mono">{error}</div>}
            {!repos && !error && <div className="dim mono">loading…</div>}
            {repos && shown.length === 0 && <div className="dim mono">no match</div>}
            {shown.map((r) => (
              <button
                key={r.full_name}
                type="button"
                className="repo-item"
                onClick={() => {
                  onPick({ url: r.html_url, branch: r.default_branch });
                  setOpen(false);
                }}
              >
                <span className="mono">{r.full_name}</span>
                <span className="repo-meta mono">
                  {r.private && <span className="repo-private">private</span>}
                  {r.language || ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
