// Small shared building blocks.
import { useEffect, useRef } from 'react';

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }) {
  return <button type="button" className={`btn btn-${variant} btn-${size} ${className}`} {...props} />;
}

export function Tag({ category }) {
  return <span className={`tag tag-${category}`}>{category}</span>;
}

export function ConfidenceBar({ value, strong }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="conf" aria-label={`confidence ${pct}%`}>
      <div className="conf-track">
        <div className={`conf-fill ${strong ? 'strong' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`conf-num mono ${strong ? '' : 'muted'}`}>{pct}%</span>
    </div>
  );
}

export function Delta({ from, to }) {
  if (from == null || to == null) return null;
  const a = Math.round(from * 100);
  const b = Math.round(to * 100);
  if (a === b) return <span className="delta mono same">= {b}%</span>;
  const up = b > a;
  return (
    <span className={`delta mono ${up ? 'up' : 'down'}`} title={`confidence ${a}% → ${b}%`}>
      {up ? '↑' : '↓'} {a}→{b}%
    </span>
  );
}

export function EvidenceChip({ ev, onOpen }) {
  const label = ev.type === 'log' ? `log L${ev.line}` : `${ev.path}:${ev.line}`;
  return (
    <button type="button" className="chip mono" title={ev.text} onClick={() => onOpen?.(ev)}>
      {label}
    </button>
  );
}

export function Skeleton({ h = 12, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange, right }) {
  const refs = useRef({});
  const onKey = (e) => {
    const i = tabs.findIndex((t) => t.id === active);
    let n = null;
    if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
    if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
    if (n) {
      e.preventDefault();
      onChange(n.id);
      refs.current[n.id]?.focus();
    }
  };
  return (
    <div className="tabs-bar">
      <div role="tablist" className="tabs" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => (refs.current[t.id] = el)}
            role="tab"
            id={`tab-${t.id}`}
            aria-controls={`panel-${t.id}`}
            aria-selected={active === t.id}
            tabIndex={active === t.id ? 0 : -1}
            className={`tab ${active === t.id ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
            type="button"
          >
            {t.label}
            {t.badge != null && <span className="tab-badge mono">{t.badge}</span>}
            <kbd className="tab-key">{t.key}</kbd>
          </button>
        ))}
      </div>
      {right && <div className="tabs-right mono">{right}</div>}
    </div>
  );
}

export function useOutsideClose(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}
