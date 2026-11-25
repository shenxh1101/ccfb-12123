import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import rulesJson from '../src/data/rules/baseline-rules.json';
import { DEMO_HOSTS } from '../src/data/demo/hosts';
import { makeBundle } from '../src/engine/fixtures';
import { scanHost, validateRuleFile } from '../src/engine/scanner';
import { buildRemediation } from '../src/engine/remediation';
import { buildReport, reportToJson, reportToMarkdown, remediationToMarkdown, REPORT_SCHEMA_VERSION } from '../src/engine/report';
import type { RuleFile } from '../src/engine/types';

const { rules } = validateRuleFile(rulesJson as unknown as RuleFile);

function fleet() {
  const bundles = DEMO_HOSTS.map((h) => makeBundle(h.name, h.files, 'demo'));
  const hosts = bundles.map((b) => scanHost(b, rules, ['sshd', 'nginx', 'sysctl']));
  const remediations = hosts.flatMap((h) => buildRemediation(bundles.find((b) => b.name === h.host)!, h.results));
  return { bundles, hosts, remediations };
}

const fixedNow = new Date('2026-01-02T03:04:05.000Z');

describe('reports', () => {
  const { hosts, remediations } = fleet();

  it('emits JSON with a stable schema shape', () => {
    const report = buildReport({
      hosts,
      remediations,
      ruleSet: { name: 'baseline', version: 1, count: rules.length },
      input: { hosts: hosts.length, files: 40, bytes: 9000 },
      durationMs: 321.7,
      now: fixedNow,
    });
    const json = JSON.parse(reportToJson(report));
    expect(Object.keys(json)).toEqual([
      'schemaVersion',
      'generatedAt',
      'tool',
      'ruleSet',
      'input',
      'durationMs',
      'totals',
      'hosts',
    ]);
    expect(json.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(json.generatedAt).toBe('2026-01-02T03:04:05.000Z');
    expect(json.durationMs).toBe(322);
    const host = json.hosts.find((h: { host: string }) => h.host === 'db-02');
    expect(Object.keys(host)).toEqual(['host', 'origin', 'score', 'summary', 'bySeverity', 'configs', 'parseIssues', 'scanMs', 'results']);
    const failing = host.results.find((r: { status: string }) => r.status === 'fail');
    expect(failing).toBeDefined();
    expect(Object.keys(failing)).toEqual([
      'ruleId', 'title', 'category', 'severity', 'status', 'message', 'observed', 'expected', 'remediation', 'evidence',
    ]);
    if (failing.evidence.length) {
      expect(Object.keys(failing.evidence[0])).toEqual(['file', 'line', 'column', 'snippet', 'block', 'note']);
    }
  });

  it('is byte-for-byte deterministic for the same scan', () => {
    const make = () =>
      reportToJson(
        buildReport({
          hosts,
          remediations,
          ruleSet: { name: 'baseline', version: 1, count: rules.length },
          input: { hosts: hosts.length, files: 1, bytes: 1 },
          durationMs: 1,
          now: fixedNow,
        }),
      );
    expect(make()).toBe(make());
  });

  it('renders Markdown with all fixed sections', () => {
    const report = buildReport({
      hosts,
      remediations,
      ruleSet: { name: 'baseline', version: 1, count: rules.length },
      input: { hosts: hosts.length, files: 40, bytes: 9000 },
      durationMs: 120,
      now: fixedNow,
    });
    const md = reportToMarkdown(report);
    for (const heading of [
      '# 配置基线检查报告',
      '## 总体结论',
      '## 主机汇总',
      '## 严重级别分布（不通过）',
      '## 主机：web-01',
      '### 未通过项',
      '### 整改建议',
      '## 附录：检查项定义',
    ]) {
      expect(md, heading).toContain(heading);
    }
    expect(md).toMatch(/\| 主机 \| 评分 \| 通过 \| 不通过 \|/);
    expect(md).toContain('### 已通过项');
    // File:line references must appear for failing checks.
    expect(md).toMatch(/\/etc\/[a-z/._-]+:\d+/);
  });

  it('escapes pipe characters so Markdown tables never break', () => {
    const report = buildReport({
      hosts,
      remediations,
      ruleSet: { name: 'baseline|v1', version: 1, count: rules.length },
      input: { hosts: 1, files: 1, bytes: 1 },
      durationMs: 1,
      now: fixedNow,
    });
    const md = reportToMarkdown(report);
    expect(md).toContain('baseline|v1');
    const badRow = md.split('\n').find((l) => l.includes('SSL') && l.startsWith('|') && l.split('|').length > 8);
    expect(badRow).toBeUndefined();
  });

  it('includes remediation diffs when asked', () => {
    const md = remediationToMarkdown(remediations);
    expect(md).toContain('## 附录：修复后配置预览');
    expect(md).toContain('```diff');
    expect(md).toMatch(/^\+ /m);
    expect(md).toMatch(/^- /m);
  });

  it('keeps report totals consistent with host summaries', () => {
    const report = buildReport({
      hosts,
      remediations,
      ruleSet: { name: 'baseline', version: 1, count: rules.length },
      input: { hosts: hosts.length, files: 1, bytes: 1 },
      durationMs: 1,
      now: fixedNow,
    });
    const sum = report.hosts.reduce((a, h) => a + h.summary.fail, 0);
    expect(report.totals.fail).toBe(sum);
    expect(report.totals.total).toBe(report.hosts.reduce((a, h) => a + h.summary.total, 0));
  });
});

describe('report fixtures', () => {
  it('sample report files on disk stay parseable (generated by scripts/build-report.ts)', () => {
    const path = 'public/samples/report-sample.json';
    try {
      const text = readFileSync(path, 'utf8');
      const parsed = JSON.parse(text);
      expect(parsed.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return; // fixture optional in unit runs
      throw err;
    }
  });
});
