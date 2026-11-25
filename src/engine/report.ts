import type { HostResult, RemediationFile, RuleResult, ScanReport, Severity } from './types';
import { SEVERITY_LABEL, SEVERITY_ORDER } from './types';
import { sortResults } from './summary';

export const REPORT_SCHEMA_VERSION = '1.0';
export const TOOL_NAME = 'Config Baseline Console';
export const TOOL_VERSION = '1.0.0';

export interface ReportInput {
  hosts: HostResult[];
  remediations: RemediationFile[];
  ruleSet: { name: string; version: number; count: number };
  input: { hosts: number; files: number; bytes: number };
  durationMs: number;
  now?: Date;
}

export function buildReport(input: ReportInput): ScanReport {
  const totals = input.hosts.reduce(
    (acc, h) => {
      acc.total += h.summary.total;
      acc.pass += h.summary.pass;
      acc.fail += h.summary.fail;
      acc.warn += h.summary.warn;
      acc.skip += h.summary.skip;
      acc.error += h.summary.error;
      for (const sev of SEVERITY_ORDER) {
        acc.bySeverity[sev].pass += h.summary.bySeverity[sev].pass;
        acc.bySeverity[sev].fail += h.summary.bySeverity[sev].fail;
        acc.bySeverity[sev].warn += h.summary.bySeverity[sev].warn;
        acc.bySeverity[sev].skip += h.summary.bySeverity[sev].skip;
        acc.bySeverity[sev].error += h.summary.bySeverity[sev].error;
      }
      return acc;
    },
    {
      total: 0,
      pass: 0,
      fail: 0,
      warn: 0,
      skip: 0,
      error: 0,
      score: 0,
      bySeverity: Object.fromEntries(
        SEVERITY_ORDER.map((s) => [s, { pass: 0, fail: 0, warn: 0, skip: 0, error: 0 }]),
      ) as Record<Severity, { pass: number; fail: number; warn: number; skip: number; error: number }>,
    },
  );
  const scored = input.hosts.filter((h) => h.summary.total - h.summary.skip > 0);
  totals.score = scored.length
    ? Math.round((scored.reduce((a, h) => a + h.summary.score, 0) / scored.length) * 10) / 10
    : 100;

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    tool: { name: TOOL_NAME, version: TOOL_VERSION },
    ruleSet: input.ruleSet,
    hosts: input.hosts,
    totals,
    input: input.input,
    durationMs: Math.round(input.durationMs),
  };
}

/** Machine-readable JSON with a frozen key order and no UI-only fields. */
export function reportToJson(report: ScanReport): string {
  const stable = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: report.generatedAt,
    tool: report.tool,
    ruleSet: report.ruleSet,
    input: report.input,
    durationMs: report.durationMs,
    totals: report.totals,
    hosts: report.hosts.map((h) => ({
      host: h.host,
      origin: h.origin ?? 'unknown',
      score: h.summary.score,
      summary: {
        total: h.summary.total,
        pass: h.summary.pass,
        fail: h.summary.fail,
        warn: h.summary.warn,
        skip: h.summary.skip,
        error: h.summary.error,
      },
      bySeverity: h.summary.bySeverity,
      configs: h.configs,
      parseIssues: h.issues,
      scanMs: Math.round(h.scanMs),
      results: sortResults(h.results).map((r) => ({
        ruleId: r.ruleId,
        title: r.title,
        category: r.category,
        severity: r.severity,
        status: r.status,
        message: r.message,
        observed: r.observed ?? null,
        expected: r.expected ?? null,
        remediation: r.remediation ?? null,
        evidence: r.evidence.map((e) => ({
          file: e.file,
          line: e.line,
          column: e.column ?? null,
          snippet: e.snippet,
          block: e.block?.length ? e.block.join(' > ') : null,
          note: e.note ?? null,
        })),
      })),
    })),
  };
  return `${JSON.stringify(stable, null, 2)}\n`;
}

function mdEscape(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function code(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const fence = t.includes('`') ? '``' : '`';
  return `${fence}${t}${fence}`;
}

export function reportToMarkdown(report: ScanReport): string {
  const L: string[] = [];
  const t = report.totals;
  L.push('# 配置基线检查报告', '');
  L.push(`- 报告格式版本：${REPORT_SCHEMA_VERSION}`);
  L.push(`- 生成工具：${report.tool.name} ${report.tool.version}`);
  L.push(`- 生成时间：${report.generatedAt}`);
  L.push(`- 规则集：${report.ruleSet.name}（v${report.ruleSet.version}，${report.ruleSet.count} 条）`);
  L.push(`- 扫描范围：${report.input.hosts} 台主机 / ${report.input.files} 个文件 / ${(report.input.bytes / 1024).toFixed(1)} KB`);
  L.push(`- 耗时：${(report.durationMs / 1000).toFixed(2)} 秒`, '');

  L.push('## 总体结论', '');
  L.push(`综合评分 **${t.score} / 100**，共检查 ${t.total} 项：通过 ${t.pass}，不通过 ${t.fail}，告警 ${t.warn}，跳过 ${t.skip}${t.error ? `，执行错误 ${t.error}` : ''}。`, '');

  L.push('## 主机汇总', '');
  L.push('| 主机 | 评分 | 通过 | 不通过 | 告警 | 跳过 | 严重 | 高 | 中 | 低 |');
  L.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const h of report.hosts) {
    L.push(
      `| ${mdEscape(h.host)} | ${h.summary.score} | ${h.summary.pass} | ${h.summary.fail} | ${h.summary.warn} | ${h.summary.skip} | ${h.summary.bySeverity.critical.fail} | ${h.summary.bySeverity.high.fail} | ${h.summary.bySeverity.medium.fail} | ${h.summary.bySeverity.low.fail} |`,
    );
  }
  L.push('');

  L.push('## 严重级别分布（不通过）', '');
  L.push('| 级别 | 主机数 |');
  L.push('| --- | ---: |');
  for (const sev of SEVERITY_ORDER) {
    const hosts = report.hosts.filter((h) => h.summary.bySeverity[sev].fail > 0).length;
    L.push(`| ${SEVERITY_LABEL[sev]} | ${hosts} |`);
  }
  L.push('');

  for (const host of report.hosts) {
    L.push(`## 主机：${host.host}`, '');
    L.push(`- 评分：${host.summary.score} / 100`);
    L.push(`- 结果：通过 ${host.summary.pass} / 不通过 ${host.summary.fail} / 告警 ${host.summary.warn} / 跳过 ${host.summary.skip}`);
    const kinds = Object.entries(host.configs)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}（${v!.files.length} 文件，${v!.statements} 条指令）`);
    if (kinds.length) L.push(`- 配置来源：${kinds.join('；')}`);
    if (host.issues.length) {
      L.push(`- 解析提示：${host.issues.length} 条`);
      for (const i of host.issues.slice(0, 8)) L.push(`  - ${i.file}:${i.line} ${i.message}`);
    }
    L.push('');

    const failing = sortResults(host.results).filter((r) => r.status === 'fail' || r.status === 'warn' || r.status === 'error');
    if (!failing.length) {
      L.push('全部检查项通过。', '');
    } else {
      L.push('### 未通过项', '');
      L.push('| 规则 | 级别 | 状态 | 说明 | 触发位置 |');
      L.push('| --- | --- | --- | --- | --- |');
      for (const r of failing) {
        const locs = [...new Set(r.evidence.map((e) => `${e.file}:${e.line}`))].slice(0, 3).join('<br>');
        L.push(`| ${r.ruleId} ${mdEscape(r.title)} | ${SEVERITY_LABEL[r.severity]} | ${statusLabel(r.status)} | ${mdEscape(r.message)} | ${locs || '—'} |`);
      }
      L.push('');

      L.push('### 整改建议', '');
      for (const r of failing) {
        L.push(`#### ${r.ruleId} ${r.title}`, '');
        L.push(`- 级别：${SEVERITY_LABEL[r.severity]}`);
        L.push(`- 分类：${r.category}`);
        if (r.observed) L.push(`- 当前值：${code(r.observed)}`);
        if (r.expected) L.push(`- 期望值：${code(r.expected)}`);
        if (r.remediation) L.push(`- 修复建议：${r.remediation}`);
        if (r.evidence.length) {
          L.push('- 触发位置：');
          for (const e of r.evidence.slice(0, 6)) {
            const via = e.via && e.via.length > 1 ? `（include 链：${e.via.join(' → ')}）` : '';
            L.push(`  - ${e.file}:${e.line} ${code(e.snippet)}${via}${e.note ? ` — ${e.note}` : ''}`);
          }
        }
        L.push('');
      }
    }

    const passed = sortResults(host.results).filter((r) => r.status === 'pass');
    if (passed.length) {
      L.push('### 已通过项', '');
      L.push('| 规则 | 级别 | 说明 |');
      L.push('| --- | --- | --- |');
      for (const r of passed) L.push(`| ${r.ruleId} ${mdEscape(r.title)} | ${SEVERITY_LABEL[r.severity]} | ${mdEscape(r.message)} |`);
      L.push('');
    }

    const skipped = host.results.filter((r) => r.status === 'skip');
    if (skipped.length) {
      L.push('### 跳过项', '');
      L.push('| 规则 | 原因 |');
      L.push('| --- | --- |');
      for (const r of skipped) L.push(`| ${r.ruleId} | ${mdEscape(r.message)} |`);
      L.push('');
    }
  }

  L.push('## 附录：检查项定义', '');
  L.push('| 规则 | 名称 | 分类 | 级别 |');
  L.push('| --- | --- | --- | --- |');
  const seenRules = new Map<string, RuleResult>();
  for (const h of report.hosts) for (const r of h.results) if (!seenRules.has(r.ruleId)) seenRules.set(r.ruleId, r);
  for (const r of [...seenRules.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId))) {
    L.push(`| ${r.ruleId} | ${mdEscape(r.title)} | ${mdEscape(r.category)} | ${SEVERITY_LABEL[r.severity]} |`);
  }
  L.push('');
  return L.join('\n');
}

export function statusLabel(status: RuleResult['status']): string {
  switch (status) {
    case 'pass':
      return '通过';
    case 'fail':
      return '不通过';
    case 'warn':
      return '告警';
    case 'skip':
      return '跳过';
    case 'error':
      return '错误';
  }
}

/** Diff of remediation, rendered as a fenced block for the report appendix. */
export function remediationToMarkdown(files: RemediationFile[]): string {
  const L: string[] = ['## 附录：修复后配置预览', ''];
  for (const f of files) {
    L.push(`### ${f.host} · ${f.file}${f.original ? '' : '（新建文件）'}`, '');
    L.push('```diff');
    for (const d of f.diff) {
      if (d.text === '…' && d.kind === 'context') L.push('…');
      else if (d.kind === 'add') L.push(`+ ${d.text}`);
      else if (d.kind === 'del') L.push(`- ${d.text}`);
      else L.push(`  ${d.text}`);
    }
    L.push('```', '');
  }
  return L.join('\n');
}
