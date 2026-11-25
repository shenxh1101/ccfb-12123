import type {
  ConfigFileModel,
  ConfigKind,
  HostBundle,
  HostResult,
  RuleCheck,
  RuleDefinition,
  RuleFile,
  RuleResult,
  RuleFixSpec,
  Severity,
  Evidence,
} from './types';
import { SEVERITY_LABEL } from './types';
import { parseNginx } from './parsers/nginx';
import { parseSshd } from './parsers/sshd';
import { parseSysctl } from './parsers/sysctl';
import { evalNginxCheck } from './evaluators/nginx';
import { evalSshdCheck } from './evaluators/sshd';
import { evalSysctlCheck } from './evaluators/sysctl';
import type { EvalOutcome } from './evaluators/common';
import { planFix } from './fix';
import { summarize } from './summary';

const KIND_LABEL: Record<ConfigKind, string> = { sshd: 'SSH 守护进程', nginx: '反向代理', sysctl: '内核参数' };

export function kindLabel(kind: ConfigKind): string {
  return KIND_LABEL[kind];
}

/** Summarise parsed models for the result payload (no re-parsing). */
export function inventoryOf(models: Partial<Record<ConfigKind, ConfigFileModel>>): HostResult['configs'] {
  const out: HostResult['configs'] = {};
  for (const [kind, model] of Object.entries(models) as [ConfigKind, ConfigFileModel][]) {
    if (!model) continue;
    out[kind] = { root: model.root, files: model.files, statements: model.stats.statements, issues: model.issues.length };
  }
  return out;
}

export function parseAll(bundle: HostBundle, kinds: ConfigKind[]): Partial<Record<ConfigKind, ConfigFileModel>> {
  const out: Partial<Record<ConfigKind, ConfigFileModel>> = {};
  if (kinds.includes('sshd')) out.sshd = parseSshd(bundle);
  if (kinds.includes('nginx')) out.nginx = parseNginx(bundle);
  if (kinds.includes('sysctl')) out.sysctl = parseSysctl(bundle);
  return out;
}

/** Which kinds actually have config files on this host. */
export function detectKinds(bundle: HostBundle): ConfigKind[] {
  const kinds: ConfigKind[] = [];
  if (bundle.order.some((p) => /(^|\/)sshd_config(\.d\/.*\.conf)?$/.test(p) || /(^|\/)sshd_config$/.test(p))) kinds.push('sshd');
  if (bundle.order.some((p) => /(^|\/)nginx\.conf$/.test(p) || /(^|\/)conf\.d\/.*\.conf$/.test(p))) kinds.push('nginx');
  if (bundle.order.some((p) => /(^|\/)sysctl\.conf$/.test(p) || /(^|\/)sysctl\.d\/.*\.conf$/.test(p))) kinds.push('sysctl');
  return kinds;
}

const CHECK_KIND: Record<RuleCheck['type'], ConfigKind> = {
  sshdValue: 'sshd',
  sshdAbsent: 'sshd',
  sshdPresent: 'sshd',
  sshdNumeric: 'sshd',
  sshdListSubset: 'sshd',
  sshdListExcludes: 'sshd',
  sysctlEquals: 'sysctl',
  sysctlNumeric: 'sysctl',
  sysctlOneOf: 'sysctl',
  nginxServerValue: 'nginx',
  nginxServerHeader: 'nginx',
  nginxServerCipher: 'nginx',
  nginxServerFile: 'nginx',
  nginxHttpValue: 'nginx',
  nginxLocationValue: 'nginx',
  nginxOrphanIncludes: 'nginx',
  allOf: 'sshd',
  anyOf: 'sshd',
  not: 'sshd',
};

function evalCheck(
  check: RuleCheck,
  models: Partial<Record<ConfigKind, ConfigFileModel>>,
  fix?: RuleFixSpec,
): EvalOutcome {
  if (check.type === 'allOf') {
    const outcomes = check.checks.map((c, i) => evalCheck(c, models, i === 0 ? fix : undefined));
    const failed = outcomes.filter((o) => o.status === 'fail' || o.status === 'error');
    const warned = outcomes.filter((o) => o.status === 'warn');
    const skipped = outcomes.filter((o) => o.status === 'skip');
    if (failed.length) {
      return {
        status: 'fail',
        message: failed.map((f) => f.message).join('；'),
        evidence: failed.flatMap((f) => f.evidence),
        observed: failed.map((f) => f.observed).filter(Boolean).join('；'),
        expected: failed.map((f) => f.expected).filter(Boolean).join('；'),
        targets: failed.flatMap((f) => f.targets ?? []),
      };
    }
    if (warned.length) {
      return { status: 'warn', message: warned.map((f) => f.message).join('；'), evidence: warned.flatMap((f) => f.evidence) };
    }
    if (skipped.length === outcomes.length) {
      return { status: 'skip', message: outcomes[0]?.message ?? '前置条件不满足', evidence: [] };
    }
    return {
      status: 'pass',
      message: outcomes.map((o) => o.message).join('；'),
      evidence: outcomes.flatMap((o) => o.evidence),
      observed: outcomes.map((o) => o.observed).filter(Boolean).join('；'),
      expected: outcomes.map((o) => o.expected).filter(Boolean).join('；'),
    };
  }
  if (check.type === 'anyOf') {
    const outcomes = check.checks.map((c) => evalCheck(c, models, fix));
    const passed = outcomes.find((o) => o.status === 'pass');
    if (passed) return { ...passed, message: `满足任一条件：${passed.message}` };
    const failed = outcomes.filter((o) => o.status === 'fail');
    if (failed.length) {
      return {
        status: 'fail',
        message: failed.map((f) => f.message).join('；'),
        evidence: failed.flatMap((f) => f.evidence),
        observed: failed.map((f) => f.observed).filter(Boolean).join('；'),
        expected: failed.map((f) => f.expected).filter(Boolean).join('；'),
        targets: failed.flatMap((f) => f.targets ?? []),
      };
    }
    return { status: 'skip', message: outcomes[0]?.message ?? '无适用条件', evidence: [] };
  }
  if (check.type === 'not') {
    const o = evalCheck(check.check, models, fix);
    if (o.status === 'skip') return o;
    return {
      ...o,
      status: o.status === 'pass' ? 'fail' : 'pass',
      message: `取反：${o.message}`,
      evidence: o.status === 'pass' ? o.evidence : [],
    };
  }
  const kind = CHECK_KIND[check.type];
  const model = models[kind];
  if (!model) return { status: 'skip', message: `未导入${KIND_LABEL[kind]}配置文件`, evidence: [] };
  try {
    if (kind === 'sshd') return evalSshdCheck(check, model, fix);
    if (kind === 'sysctl') return evalSysctlCheck(check, model, fix);
    return evalNginxCheck(check, model, fix);
  } catch (err) {
    return {
      status: 'error',
      message: `规则执行失败：${(err as Error).message}`,
      evidence: [],
    };
  }
}

export function primaryKind(rule: RuleDefinition): ConfigKind {
  const t = rule.check.type;
  if (t === 'allOf' || t === 'anyOf' || t === 'not') return rule.kind;
  return CHECK_KIND[t];
}

export function scanHost(bundle: HostBundle, rules: RuleDefinition[], requested: ConfigKind[]): HostResult {
  const start = performance.now();
  // Only evaluate kinds that actually have config files on this host; a rule for
  // an absent kind is reported as skipped rather than failed.
  const present = detectKinds(bundle);
  const kinds = requested.filter((k) => present.includes(k));
  const models = parseAll(bundle, kinds);
  const results: RuleResult[] = [];
  const issues = Object.values(models).flatMap((m) => m?.issues ?? []);

  for (const rule of rules) {
    const t0 = performance.now();
    const kind = primaryKind(rule);
    if (!kinds.includes(kind)) {
      results.push({
        ruleId: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        status: 'skip',
        message: `未导入${kindLabel(kind)}配置`,
        evidence: [],
        remediation: rule.remediation,
        durationMs: performance.now() - t0,
      });
      continue;
    }
    const outcome = evalCheck(rule.check, models, rule.fix);
    const model = models[kind];
    let fix = undefined;
    if ((outcome.status === 'fail' || outcome.status === 'warn') && model) {
      try {
        fix = planFix(rule, model, outcome);
      } catch (err) {
        fix = undefined;
        outcome.evidence.push({
          file: model.root,
          line: 1,
          snippet: '',
          note: `修复计划生成失败：${(err as Error).message}`,
        });
      }
    }
    results.push({
      ruleId: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      status: outcome.status,
      message: outcome.message,
      evidence: dedupeEvidence(outcome.evidence),
      observed: outcome.observed,
      expected: outcome.expected,
      remediation: rule.remediation,
      fix,
      durationMs: performance.now() - t0,
    });
  }

  for (const kind of requested) {
    if (!kinds.includes(kind)) {
      issues.push({ file: '-', line: 0, severity: 'info', message: `未发现${kindLabel(kind)}配置文件，相关检查项已跳过` });
    }
  }

  return {
    host: bundle.name,
    origin: bundle.meta.origin,
    results,
    summary: summarize(results),
    configs: inventoryOf(models),
    issues,
    scanMs: performance.now() - start,
  };
}

export function dedupeEvidence(list: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const e of list) {
    const key = `${e.file}:${e.line}:${e.snippet}:${e.note ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export function validateRuleFile(input: unknown): { rules: RuleDefinition[]; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { rules: [], errors: ['规则文件必须是 JSON 对象'] };
  const file = input as Partial<RuleFile>;
  if (!Array.isArray(file.rules)) return { rules: [], errors: ['缺少 rules 数组'] };
  const rules: RuleDefinition[] = [];
  const ids = new Set<string>();
  const severities: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const kinds: ConfigKind[] = ['sshd', 'nginx', 'sysctl'];
  file.rules.forEach((raw, i) => {
    const where = `rules[${i}]`;
    if (!raw || typeof raw !== 'object') {
      errors.push(`${where} 不是对象`);
      return;
    }
    const r = raw as RuleDefinition;
    if (!r.id || typeof r.id !== 'string') errors.push(`${where} 缺少 id`);
    else if (ids.has(r.id)) errors.push(`${where} id 重复：${r.id}`);
    else ids.add(r.id);
    if (!r.title) errors.push(`${where} 缺少 title`);
    if (!r.category) errors.push(`${where} 缺少 category`);
    if (!severities.includes(r.severity)) errors.push(`${where} severity 非法：${String(r.severity)}`);
    if (!kinds.includes(r.kind)) errors.push(`${where} kind 非法：${String(r.kind)}`);
    if (!r.check || typeof r.check !== 'object' || !(r.check as RuleCheck).type) errors.push(`${where} 缺少 check.type`);
    if (!r.remediation) errors.push(`${where} 缺少 remediation`);
    if (!errors.some((e) => e.startsWith(where))) rules.push(r);
  });
  return { rules, errors };
}

export { SEVERITY_LABEL };
