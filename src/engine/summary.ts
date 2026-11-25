import type { HostResult, RuleResult, ScanSummary, Severity } from './types';
import { SEVERITY_ORDER } from './types';

export function emptySummary(): ScanSummary {
  return {
    total: 0,
    pass: 0,
    fail: 0,
    warn: 0,
    skip: 0,
    error: 0,
    score: 100,
    bySeverity: Object.fromEntries(
      SEVERITY_ORDER.map((s) => [s, { pass: 0, fail: 0, warn: 0, skip: 0, error: 0 }]),
    ) as Record<Severity, { pass: number; fail: number; warn: number; skip: number; error: number }>,
  };
}

/** Severity weights: a failed critical costs 10x a failed info item. */
const WEIGHT: Record<Severity, number> = { critical: 10, high: 6, medium: 3, low: 1.5, info: 0.5 };

/** Weighted pass ratio. Skips are excluded from both sides, warnings earn half
 *  credit, errors count as failures. */
export function summarize(results: RuleResult[]): ScanSummary {
  const s = emptySummary();
  let earned = 0;
  let possible = 0;
  for (const r of results) {
    s.total++;
    s[r.status]++;
    s.bySeverity[r.severity][r.status]++;
    if (r.status === 'skip') continue;
    const w = WEIGHT[r.severity];
    possible += w;
    if (r.status === 'pass') earned += w;
    else if (r.status === 'warn') earned += w * 0.5;
  }
  s.score = possible > 0 ? Math.round((earned / possible) * 1000) / 10 : 100;
  return s;
}

export function mergeSummaries(list: ScanSummary[]): ScanSummary {
  const out = emptySummary();
  for (const s of list) {
    out.total += s.total;
    out.pass += s.pass;
    out.fail += s.fail;
    out.warn += s.warn;
    out.skip += s.skip;
    out.error += s.error;
    for (const sev of SEVERITY_ORDER) {
      out.bySeverity[sev].pass += s.bySeverity[sev].pass;
      out.bySeverity[sev].fail += s.bySeverity[sev].fail;
      out.bySeverity[sev].warn += s.bySeverity[sev].warn;
      out.bySeverity[sev].skip += s.bySeverity[sev].skip;
      out.bySeverity[sev].error += s.bySeverity[sev].error;
    }
  }
  const scored = list.filter((s) => s.total - s.skip > 0);
  out.score = scored.length ? Math.round((scored.reduce((a, s) => a + s.score, 0) / scored.length) * 10) / 10 : 100;
  return out;
}

export function scoreLabel(score: number): { label: string; tone: 'good' | 'ok' | 'bad' } {
  if (score >= 90) return { label: '良好', tone: 'good' };
  if (score >= 70) return { label: '需关注', tone: 'ok' };
  return { label: '高风险', tone: 'bad' };
}

/** Rules sorted by severity, then failures before passes. */
export function sortResults(results: RuleResult[]): RuleResult[] {
  const order = new Map(SEVERITY_ORDER.map((s, i) => [s, i]));
  const statusRank: Record<RuleResult['status'], number> = { fail: 0, error: 1, warn: 2, pass: 3, skip: 4 };
  return [...results].sort(
    (a, b) =>
      (order.get(a.severity) ?? 9) - (order.get(b.severity) ?? 9) ||
      statusRank[a.status] - statusRank[b.status] ||
      a.ruleId.localeCompare(b.ruleId),
  );
}

export function hostLabel(h: HostResult): string {
  return h.host;
}
