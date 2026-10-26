import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import ThemeToggle from '../theme/ThemeToggle.jsx';
import { REPO_URL } from '../data/site.js';
import './TopBar.css';

const NAV = [
  { to: '/app', label: 'Workspace' },
  { to: '/cases', label: 'Cases' },
  { to: '/benchmarks', label: 'Benchmarks' },
  { to: '/how-it-works', label: 'How it works' },
];

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const { pathname, search } = useLocation();
  useEffect(() => setOpen(false), [pathname, search]);

  return (
    <header className="topbar">
      <Link to="/" className="topbar-brand">
        DevOpsDoctor
      </Link>
      <nav id="main-nav" className={`topbar-nav ${open ? 'open' : ''}`} aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => 'topbar-link' + (isActive ? ' active' : '')}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="topbar-right">
        <ThemeToggle />
        <a className="icon-btn" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub repository" title="GitHub repository">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
        <button
          type="button"
          className="icon-btn menu-btn"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            {open ? <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" strokeLinecap="round" /> : <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />}
          </svg>
        </button>
      </div>
    </header>
  );
}
