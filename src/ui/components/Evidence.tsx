import { useMemo, useState } from 'react';
import type { Evidence, RuleResult } from '../../engine/types';
import { Icon } from './primitives';

/** Renders a small code window around the triggering line. */
export function SourceSnippet({
  content,
  line,
  highlight = 'fail',
  context = 2,
  maxLines = 14,
}: {
  content: string;
  line: number;
  highlight?: 'fail' | 'pass' | 'none';
  context?: number;
  maxLines?: number;
}) {
  const lines = useMemo(() => content.split(/\r?\n/), [content]);
  const start = Math.max(1, line - context);
  const end = Math.min(lines.length, line + context);
  const shown: number[] = [];
  for (let i = start; i <= end && shown.length < maxLines; i++) shown.push(i);
  const cls = highlight === 'pass' ? 'hl-pass' : highlight === 'fail' ? 'hl' : '';
  return (
    <div className="code" role="region" aria-label={`配置文件第 ${line} 行`}>
      {shown.map((n) => (
        <div key={n} className={`code-line ${n === line ? cls : ''}`}>
          <span className="ln">{n}</span>
          <span className="tx">{lines[n - 1] ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

/** Full file with optional highlighted line set, used by the config viewer. */
export function CodeView({
  content,
  highlights,
  startLine = 1,
  maxHeight,
}: {
  content: string;
  highlights?: Map<number, 'fail' | 'pass' | 'warn'>;
  startLine?: number;
  maxHeight?: number;
}) {
  const lines = useMemo(() => content.split(/\r?\n/), [content]);
  return (
    <div className="code" style={maxHeight ? { maxHeight } : undefined}>
      {lines.map((text, i) => {
        const n = i + 1;
        const hl = highlights?.get(n);
        return (
          <div key={n} className={`code-line ${hl ? `hl${hl === 'pass' ? '-pass' : ''}` : ''}`}>
            <span className="ln">{n + startLine - 1}</span>
            <span className="tx">{text || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) {
    return <div className="faint small">该检查项没有定位到具体配置行（使用系统默认值或不适用）。</div>;
  }
  return (
    <div className="evidence">
      {evidence.map((e, i) => (
        <div className="evidence-item" key={`${e.file}:${e.line}:${i}`}>
          <div className="evidence-head">
            <Icon name="file" size={13} />
            <span className="evidence-path">
              {e.file}
              <b>:{e.line}</b>
              {e.column ? <span className="faint">:{e.column}</span> : null}
            </span>
            {e.block && e.block.length ? <span className="badge plain mono">{e.block.join(' › ')}</span> : null}
          </div>
          <div className="evidence-body">
            {e.snippet ? <code className="snippet">{e.snippet.trim()}</code> : null}
            {e.via && e.via.length > 1 ? (
              <div className="via-chain">
                <Icon name="layers" size={12} />
                {e.via.map((p, idx) => (
                  <span key={p + idx}>
                    {idx > 0 ? <span className="sep"> → </span> : null}
                    {p}
                  </span>
                ))}
              </div>
            ) : null}
            {e.note ? <div className="evidence-note">{e.note}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Collapsible result row with evidence, remediation text and actions. */
export function ResultRow({
  result,
  fileContents,
  defaultOpen = false,
  actions,
}: {
  result: RuleResult;
  fileContents: (file: string) => string | undefined;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`result-row ${open ? 'expanded' : ''}`}>
      <div className="result-head" onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v); }}
        aria-expanded={open}
      >
        <Icon
          name="chevron"
          size={13}
          style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .15s', color: 'var(--text-faint)', flex: '0 0 13px' }}
        />
        <span className="badge plain mono">{result.ruleId}</span>
        <span className="result-title">{result.title}</span>
        <span className="result-msg">{result.message}</span>
        <span className="row" style={{ gap: 6 }}>
          {result.evidence.length ? <span className="badge plain mono">{result.evidence.length} 处</span> : null}
          <span className="badge plain">{result.category}</span>
        </span>
      </div>
      {open ? (
        <div className="result-body">
          <dl className="result-kv">
            {result.observed !== undefined ? (
              <>
                <dt>当前值</dt>
                <dd><code className="snippet">{result.observed || '(空)'}</code></dd>
              </>
            ) : null}
            {result.expected !== undefined ? (
              <>
                <dt>期望值</dt>
                <dd><code className="snippet">{result.expected}</code></dd>
              </>
            ) : null}
            <dt>判定</dt>
            <dd>{result.message}</dd>
            {result.remediation ? (
              <>
                <dt>修复建议</dt>
                <dd>{result.remediation}</dd>
              </>
            ) : null}
          </dl>
          {result.evidence.map((e, i) => {
            const content = fileContents(e.file);
            if (!content) return null;
            return (
              <div key={`${e.file}:${e.line}:${i}`}>
                <div className="row small dim" style={{ marginBottom: 5 }}>
                  <Icon name="code" size={13} />
                  <span className="mono">{e.file}</span>
                  <span className="faint">第 {e.line} 行</span>
                </div>
                <SourceSnippet content={content} line={e.line} highlight={result.status === 'pass' ? 'pass' : 'fail'} />
              </div>
            );
          })}
          {actions ? <div className="rule-actions">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
