import { forwardRef, useState } from 'react';
import { ConfidenceBar, Delta, EvidenceChip, Tag } from './ui.jsx';

export function hypothesisMarkdown(h, rank) {
  const refs = h.evidence.map((e) => (e.type === 'log' ? `log L${e.line}` : `${e.path}:${e.line}`));
  return [
    `**#${rank} ${h.title}** (${h.category}, ${Math.round(h.confidence * 100)}% confidence)`,
    h.reasoning && `\n${h.reasoning}`,
    refs.length && `\nEvidence: ${refs.map((r) => `\`${r}\``).join(', ')}`,
    h.rule_out && `\nRules out if: ${h.rule_out}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// Used live on /app and with static data on the Overview page.
const HypothesisCard = forwardRef(function HypothesisCard(
  { h, rank, delta, top, selected, onEvidence, onSelect, onShowPatch, compact, commitSlot },
  ref
) {
  const [copied, setCopied] = useState(false);
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hypothesisMarkdown(h, rank));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can be blocked; nothing else to do.
    }
  };
  const dropped = h.dropped_evidence || [];

  return (
    <article
      ref={ref}
      tabIndex={onSelect ? 0 : undefined}
      className={`hyp ${top ? 'top' : ''} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect?.()}
      onFocus={() => onSelect?.()}
      aria-label={`Hypothesis ${rank}: ${h.title}`}
    >
      <header className="hyp-head">
        <span className="hyp-rank mono">{String(rank).padStart(2, '0')}</span>
        <h3 className="hyp-title">{h.title}</h3>
        <Tag category={h.category} />
        <div className="hyp-conf">
          {delta && <Delta from={delta.from} to={delta.to} />}
          <ConfidenceBar value={h.confidence} strong={top} />
        </div>
      </header>
      {h.reasoning && !compact && <p className="hyp-reason">{h.reasoning}</p>}
      <footer className="hyp-foot">
        <div className="hyp-ev">
          <span className="hyp-label mono">Evidence:</span>
          {h.evidence.map((ev, i) => (
            <EvidenceChip key={i} ev={ev} onOpen={onEvidence} />
          ))}
          {dropped.length > 0 && (
            <span className="dropped mono" title={dropped.map((d) => `${d.ref}: ${d.reason}`).join('\n')}>
              {dropped.length} ref{dropped.length > 1 ? 's' : ''} dropped (not found)
            </span>
          )}
        </div>
        {h.rule_out && (
          <div className="hyp-ruleout mono">
            rules out if: <span>{h.rule_out}</span>
          </div>
        )}
        {!compact && (
          <div className="hyp-actions">
            {h.patch && onShowPatch && (
              <button type="button" className="link-btn" onClick={(e) => (e.stopPropagation(), onShowPatch())}>
                view patch
              </button>
            )}
            {commitSlot}
            <button type="button" className="link-btn" onClick={copy}>
              {copied ? 'copied' : 'copy as markdown'}
            </button>
          </div>
        )}
      </footer>
    </article>
  );
});

export default HypothesisCard;
