import type { ReactNode, SVGProps } from 'react';
import type { Severity, RuleStatus } from '../../engine/types';
import { SEVERITY_LABEL } from '../../engine/types';

type IconName =
  | 'import'
  | 'rules'
  | 'scan'
  | 'wrench'
  | 'report'
  | 'search'
  | 'check'
  | 'x'
  | 'chevron'
  | 'upload'
  | 'file'
  | 'folder'
  | 'alert'
  | 'info'
  | 'download'
  | 'play'
  | 'refresh'
  | 'copy'
  | 'shield'
  | 'server'
  | 'code'
  | 'filter'
  | 'trash'
  | 'sparkle'
  | 'layers';

const PATHS: Record<IconName, ReactNode> = {
  import: <path d="M12 3v10m0 0 4-4m-4 4-4-4M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />,
  rules: <path d="M8 4h9l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm8 1v4h4M10 12h6M10 16h6M10 8h2" />,
  scan: <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35M7.5 11.5l2.5 2.5 4-4.5" />,
  wrench: <path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L3 17.6V21h3.4l5.7-5.7a4.5 4.5 0 0 0 5.6-6L14.5 12l-2.5-2.5 2.7-3.2Z" />,
  report: <path d="M7 3h7l5 5v13H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 1v5h5M10 13h6M10 17h6M10 9h1" />,
  search: <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35" />,
  check: <path d="m4 12.5 5 5L20 6.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  upload: <path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" />,
  file: <path d="M7 3h7l5 5v13H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 1v5h5" />,
  folder: <path d="M4 6h6l2 2h8v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6Z" />,
  alert: <path d="M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.5" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v.5M12 11v6" />,
  download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />,
  play: <path d="M7 4.5v15l13-7.5L7 4.5Z" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 6.1M20 4v7h-7" />,
  copy: <path d="M9 9h11v11H9V9Zm-1-5h11v3M4 4v13a2 2 0 0 0 2 2h1" />,
  shield: <path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Zm-3 9 2.5 2.5L16 9" />,
  server: <path d="M4 5h16v5H4V5Zm0 9h16v5H4v-5Zm2.5-6.5h.5m-.5 9h.5M9 7.5h7M9 16.5h7" />,
  code: <path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14" />,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />,
  trash: <path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14M10 11v6m4-6v6" />,
  sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm9 9-9 5-9-5m18 5-9 5-9-5" />,
};

export function Icon({
  name,
  size = 16,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

export const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'sev-critical',
  high: 'sev-high',
  medium: 'sev-medium',
  low: 'sev-low',
  info: 'sev-info',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge ${SEVERITY_CLASS[severity]}`}>{SEVERITY_LABEL[severity]}</span>;
}

const STATUS_CLASS: Record<RuleStatus, string> = {
  pass: 'st-pass',
  fail: 'st-fail',
  warn: 'st-warn',
  skip: 'st-skip',
  error: 'st-error',
};

const STATUS_TEXT: Record<RuleStatus, string> = {
  pass: '通过',
  fail: '不通过',
  warn: '告警',
  skip: '跳过',
  error: '错误',
};

export function StatusBadge({ status }: { status: RuleStatus }) {
  return (
    <span className={`badge ${STATUS_CLASS[status]}`}>
      <i className="dot" />
      {STATUS_TEXT[status]}
    </span>
  );
}

export function ScoreRing({ score, size = 74 }: { score: number; size?: number }) {
  const tone = score >= 90 ? 'good' : score >= 70 ? 'ok' : 'bad';
  return (
    <div
      className={`score-ring ${tone}`}
      style={{ ['--pct' as string]: Math.max(0, Math.min(100, score)), ['--size' as string]: `${size}px` }}
      role="img"
      aria-label={`合规评分 ${score} 分`}
    >
      <div className="val">
        {Math.round(score)}
        <small>分</small>
      </div>
    </div>
  );
}

export function EmptyState({
  icon = 'info',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={42} className="icon" />
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function ProgressBar({ value, total, indeterminate }: { value: number; total: number; indeterminate?: boolean }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className={`progress ${indeterminate ? 'indeterminate' : ''}`} role="progressbar" aria-valuenow={value} aria-valuemax={total}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
