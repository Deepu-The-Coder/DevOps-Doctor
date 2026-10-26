import { useState } from 'react';
import { useOutsideClose } from './ui.jsx';

const ROWS = [
  ['Ctrl/⌘ + Enter', 'Run diagnosis'],
  ['P', 'Run probes'],
  ['1 – 5', 'Focus hypothesis N'],
  ['F / R / D', 'Files / Probes / Patch tab'],
  ['Shift + T', 'Toggle theme'],
  ['?', 'Show this list'],
];

export default function ShortcutsPopover({ open, setOpen }) {
  const ref = useOutsideClose(open, () => setOpen(false));
  return (
    <div className="popover-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn mono"
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Keyboard shortcuts">
          <div className="section-label" style={{ marginBottom: 6 }}>
            Shortcuts
          </div>
          <table>
            <tbody>
              {ROWS.map(([k, v]) => (
                <tr key={k}>
                  <td>
                    <kbd>{k}</kbd>
                  </td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
