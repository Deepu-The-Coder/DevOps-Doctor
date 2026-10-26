import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { loginUrl } from '../api.js';
import { signOut, useAuth } from '../auth.js';
import { useOutsideClose } from './ui.jsx';

const GH_PATH =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z';

export function GitHubMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d={GH_PATH} />
    </svg>
  );
}

// Top-bar control: "Sign in with GitHub", or the signed-in user's avatar with a menu.
export default function AccountMenu() {
  const { loading, configured, user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const { pathname, search } = useLocation();

  if (loading) return null;

  if (!user && configured)
    return (
      <a className="btn btn-secondary btn-sm signin-btn" href={loginUrl(pathname + search)}>
        <GitHubMark size={14} />
        <span className="signin-label">Sign in with GitHub</span>
      </a>
    );

  // Not configured on this server: keep the button visible and explain the setup.
  if (!user)
    return (
      <div className="popover-wrap" ref={ref}>
        <button type="button" className="btn btn-secondary btn-sm signin-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <GitHubMark size={14} />
          <span className="signin-label">Sign in with GitHub</span>
        </button>
        {open && (
          <div className="popover account-pop" role="dialog" aria-label="GitHub sign-in setup">
            <div className="account-name">GitHub sign-in isn't set up on this server</div>
            <ol className="account-steps">
              <li>
                Create an OAuth App at <span className="mono">github.com/settings/developers</span>
              </li>
              <li>
                Callback URL: <span className="mono">{window.location.origin}/api/auth/github/callback</span>
              </li>
              <li>
                Add <span className="mono">GITHUB_CLIENT_ID</span> and <span className="mono">GITHUB_CLIENT_SECRET</span> to{' '}
                <span className="mono">backend/.env</span> and restart the backend.
              </li>
            </ol>
            <p className="account-note">Public repos work without signing in.</p>
          </div>
        )}
      </div>
    );

  return (
    <div className="popover-wrap" ref={ref}>
      <button
        type="button"
        className="avatar-btn"
        aria-label={`Signed in as ${user.login}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <img src={user.avatar_url} alt="" width="22" height="22" />
      </button>
      {open && (
        <div className="popover account-pop" role="menu">
          <div className="account-who">
            <img src={user.avatar_url} alt="" width="32" height="32" />
            <div>
              <div className="account-name">{user.name}</div>
              <a className="mono account-login" href={user.html_url} target="_blank" rel="noreferrer">
                @{user.login}
              </a>
            </div>
          </div>
          <p className="account-note">
            Your token stays on the server and is used only to read repos. It is never sent to the model.
          </p>
          <button
            type="button"
            role="menuitem"
            className="btn btn-secondary btn-sm"
            style={{ width: '100%' }}
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
