import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CASES } from '../data/cases.js';
import './Cases.css';

function useLogSizes() {
  const [sizes, setSizes] = useState({});
  useEffect(() => {
    let alive = true;
    Promise.all(
      CASES.map((c) =>
        fetch(c.log)
          .then((r) => (r.ok ? r.text() : ''))
          .then((t) => [c.id, t ? { lines: t.trimEnd().split('\n').length, bytes: new Blob([t]).size } : null])
          .catch(() => [c.id, null])
      )
    ).then((pairs) => alive && setSizes(Object.fromEntries(pairs)));
    return () => {
      alive = false;
    };
  }, []);
  return sizes;
}

export default function Cases() {
  const sizes = useLogSizes();
  return (
    <div className="cases-page">
      <header className="cases-head">
        <h1>Case library</h1>
        <p>
          Four broken deploys of the same app. They fail with the same symptom; the root causes differ. Open one to load
          its repo and log into the workspace, ready to run.
        </p>
      </header>

      <table className="cases-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Symptom</th>
            <th>Stack</th>
            <th>Platform</th>
            <th className="num">Log</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {CASES.map((c) => {
            const s = sizes[c.id];
            return (
              <tr key={c.id}>
                <td className="mono case-id">{c.id}</td>
                <td className="symptom">
                  <div>{c.symptom}</div>
                  <details className="reveal">
                    <summary>Reveal answer</summary>
                    <div className="answer">{c.answer}</div>
                  </details>
                </td>
                <td className="nowrap">{c.stack}</td>
                <td className="nowrap">{c.platform}</td>
                <td className="mono num nowrap">{s ? `${s.lines} lines · ${(s.bytes / 1024).toFixed(1)} KB` : '–'}</td>
                <td className="nowrap">
                  <Link className="btn btn-primary btn-sm" to={`/app?case=${c.id}`}>
                    Open in workspace
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="cases-foot mono">
        source: <a href="https://github.com/Deepu-The-Coder/DevOps-Doctor/tree/main/sample-app">sample-app/</a> · logs:{' '}
        <span>frontend/public/cases/</span>
      </p>
    </div>
  );
}
