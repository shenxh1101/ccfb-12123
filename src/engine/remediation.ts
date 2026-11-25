import type { DiffLine, FixOp, HostBundle, RemediationFile, RuleResult } from './types';
import { splitLines } from './paths';

/** Group ops from many rule results by host+file. */
export function collectFixOps(results: RuleResult[]): Map<string, { ops: FixOp[]; creates: { file: string; content: string; ruleIds: string[] }[] }> {
  const byFile = new Map<string, { ops: FixOp[]; creates: { file: string; content: string; ruleIds: string[] }[] }>();
  for (const r of results) {
    if (!r.fix) continue;
    for (const op of r.fix.ops) {
      const entry = byFile.get(op.file) ?? { ops: [], creates: [] };
      entry.ops.push({ ...op, ruleId: r.ruleId });
      byFile.set(op.file, entry);
    }
    for (const c of r.fix.createFiles ?? []) {
      const entry = byFile.get(c.file) ?? { ops: [], creates: [] };
      entry.creates.push({ ...c, ruleIds: [...(c.ruleIds ?? []), r.ruleId] });
      byFile.set(c.file, entry);
    }
  }
  return byFile;
}

/** Apply a set of ops (all anchored on ORIGINAL line numbers) to file content. */
export function applyOps(original: string, ops: FixOp[]): string {
  const lines = splitLines(original);
  // Sort descending by line so earlier line numbers stay valid; for identical
  // anchors keep plan order stable by reversing after the descending sort.
  const indexed = ops.map((op, i) => ({ op, i }));
  indexed.sort((a, b) => b.op.line - a.op.line || b.i - a.i);
  const out = [...lines];
  for (const { op } of indexed) {
    const idx = op.line - 1;
    if (idx < 0 || idx > out.length) continue;
    if (op.kind === 'replace' || op.kind === 'delete') {
      if (idx >= out.length) continue;
      if (op.kind === 'delete') {
        out.splice(idx, 1);
      } else {
        const indent = op.indent ?? leadingSpace(out[idx]);
        out.splice(idx, 1, `${indent}${op.text ?? ''}`);
      }
      continue;
    }
    const indent = op.indent ?? leadingSpace(out[idx] ?? '');
    const insertAt = op.kind === 'insertBefore' ? idx : idx + 1;
    out.splice(Math.min(Math.max(insertAt, 0), out.length), 0, `${indent}${op.text ?? ''}`);
  }
  return out.join('\n');
}

function leadingSpace(line: string | undefined): string {
  return (line ?? '').match(/^[ \t]*/)?.[0] ?? '';
}

/** Unified-style diff (3 lines of context) computed with an LCS table. */
export function diffLines(oldText: string, newText: string, context = 3): DiffLine[] {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  // Myers would be faster, but config files are small and this is easy to read.
  const n = a.length;
  const m = b.length;
  if (n * m > 4_000_000) return naiveDiff(a, b);
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const raw: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ kind: 'context', text: a[i], oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ kind: 'del', text: a[i], oldLine: i + 1 });
      i++;
    } else {
      raw.push({ kind: 'add', text: b[j], newLine: j + 1 });
      j++;
    }
  }
  while (i < n) raw.push({ kind: 'del', text: a[i], oldLine: ++i });
  while (j < m) raw.push({ kind: 'add', text: b[j], newLine: ++j });
  return trimContext(raw, context);
}

function naiveDiff(a: string[], b: string[]): DiffLine[] {
  const out: DiffLine[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) out.push({ kind: 'context', text: a[i], oldLine: i + 1, newLine: i + 1 });
    else {
      if (a[i] !== undefined) out.push({ kind: 'del', text: a[i], oldLine: i + 1 });
      if (b[i] !== undefined) out.push({ kind: 'add', text: b[i], newLine: i + 1 });
    }
  }
  return out;
}

function trimContext(lines: DiffLine[], context: number): DiffLine[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.kind === 'context') return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const out: DiffLine[] = [];
  let skipping = false;
  lines.forEach((l, i) => {
    if (keep[i]) {
      out.push(l);
      skipping = false;
    } else if (!skipping) {
      out.push({ kind: 'context', text: '…', oldLine: -1, newLine: -1 });
      skipping = true;
    }
  });
  return out;
}

export interface RemediationOptions {
  /** Which failing rules to include; defaults to all failures/warnings with a fix. */
  ruleIds?: Set<string>;
  /** When true, also drop warnings without a concrete fix. */
  includeWarnings?: boolean;
}

/** Build patched files for a host from scan results. */
export function buildRemediation(
  bundle: HostBundle,
  results: RuleResult[],
  options: RemediationOptions = {},
): RemediationFile[] {
  const selected = results.filter(
    (r) =>
      r.fix &&
      (r.status === 'fail' || (options.includeWarnings !== false && r.status === 'warn')) &&
      (!options.ruleIds || options.ruleIds.has(r.ruleId)),
  );
  const grouped = collectFixOps(selected);
  const out: RemediationFile[] = [];

  for (const [file, group] of grouped) {
    const original = bundle.files.get(file)?.content ?? '';
    const isNew = !bundle.files.has(file);
    const patched = isNew
      ? group.creates.map((c) => c.content.replace(/\n$/, '')).join('\n') + '\n'
      : applyOps(original, group.ops);
    const ruleIds = [...new Set([...group.ops.map((o) => o.ruleId!), ...group.creates.flatMap((c) => c.ruleIds)])].sort();
    if (isNew && !group.creates.length) continue;
    out.push({
      host: bundle.name,
      file,
      original,
      patched,
      diff: diffLines(original, patched),
      ops: group.ops,
      ruleIds,
    });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

/** Short human summary for the remediation page header. */
export function remediationStats(files: RemediationFile[]): { files: number; added: number; removed: number; rules: number } {
  let added = 0;
  let removed = 0;
  const rules = new Set<string>();
  for (const f of files) {
    for (const d of f.diff) {
      if (d.kind === 'add') added++;
      if (d.kind === 'del') removed++;
    }
    for (const r of f.ruleIds) rules.add(r);
  }
  return { files: files.length, added, removed, rules: rules.size };
}
