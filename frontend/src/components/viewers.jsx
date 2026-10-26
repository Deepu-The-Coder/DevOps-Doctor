// Code, log and diff viewers. All colors come from theme tokens.
import { useEffect, useRef } from 'react';

export function CodeViewer({ content, focusLine, citedLines }) {
  const focusRef = useRef(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center' });
  }, [focusLine, content]);
  const lines = (content || '').split('\n');
  const cited = citedLines || new Set();
  return (
    <div className="viewer code-viewer mono">
      <table>
        <tbody>
          {lines.map((l, i) => {
            const n = i + 1;
            const cls = n === focusLine ? 'focus' : cited.has(n) ? 'cited' : '';
            return (
              <tr key={n} className={cls} ref={n === focusLine ? focusRef : null}>
                <td className="gutter">{n}</td>
                <td className="src">{l || ' '}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const isErr = (l) => /\b(error|fatal|failed|exception|refused|terminated)\b/i.test(l);

export function LogViewer({ lines, focusLine, citedLines }) {
  const focusRef = useRef(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center' });
  }, [focusLine]);
  const cited = citedLines || new Set();
  return (
    <div className="viewer log-viewer mono">
      {lines.map((l, i) => {
        const n = i + 1;
        const cls = [n === focusLine && 'focus', cited.has(n) && 'cited', isErr(l) && 'err'].filter(Boolean).join(' ');
        return (
          <div key={n} className={`log-line ${cls}`} ref={n === focusLine ? focusRef : null}>
            <span className="gutter">{n}</span>
            <span className="src">{l || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DiffViewer({ diff }) {
  const lines = String(diff || '').replace(/\r\n/g, '\n').split('\n');
  return (
    <div className="viewer diff-viewer mono">
      {lines.map((l, i) => {
        let cls = '';
        let sign = ' ';
        if (l.startsWith('+++') || l.startsWith('---')) cls = 'meta';
        else if (l.startsWith('@@')) cls = 'hunk';
        else if (l.startsWith('+')) (cls = 'add'), (sign = '+');
        else if (l.startsWith('-')) (cls = 'del'), (sign = '−');
        const body = cls === 'add' || cls === 'del' ? l.slice(1) : l;
        return (
          <div key={i} className={`diff-line ${cls}`}>
            <span className="gutter">{cls === 'meta' || cls === 'hunk' ? '' : sign}</span>
            <span className="src">{body || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}
