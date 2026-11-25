import type { ConfigFileModel, ConfigNode, RuleCheck, RuleFixSpec } from '../types';
import { numericSysctl, sysctlAllValues, sysctlEffective } from '../parsers/sysctl';
import { compareNumeric, evidenceOf, type EvalOutcome } from './common';

function norm(v: string | number): string {
  return String(v).trim().replace(/\s+/g, ' ');
}

function eqLoose(a: string | undefined, b: string | number): boolean {
  if (a === undefined) return false;
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  const nx = numericSysctl(x);
  const ny = typeof b === 'number' ? b : numericSysctl(String(b));
  return nx !== null && ny !== null && nx === ny;
}

function shadowing(model: ConfigFileModel, key: string): ConfigNode[] {
  const all = sysctlAllValues(model, key);
  return all.length > 1 ? all.slice(0, -1) : [];
}

function fixFile(model: ConfigFileModel, fix?: RuleFixSpec): string {
  if (fix?.file && model.availableFiles.includes(fix.file)) return fix.file;
  if (model.availableFiles.includes('/etc/sysctl.d/99-hardening.conf')) return '/etc/sysctl.d/99-hardening.conf';
  if (model.availableFiles.length) {
    const conf = model.availableFiles.filter((p) => /\/sysctl\.d\/.*\.conf$/.test(p)).sort().pop();
    if (conf) return conf;
    if (model.availableFiles.includes('/etc/sysctl.conf')) return '/etc/sysctl.conf';
  }
  return model.root;
}

export function evalSysctlCheck(check: RuleCheck, model: ConfigFileModel, fix?: RuleFixSpec): EvalOutcome {
  const eff = sysctlEffective(model);
  const targets = (key: string, value: string | number, node?: ConfigNode) => [
    {
      key,
      args: [String(value)],
      node,
      fallbackFile: fixFile(model, fix),
      note: node ? undefined : '在优先级最高的 sysctl 配置文件中追加',
    },
  ];

  switch (check.type) {
    case 'sysctlEquals': {
      const node = eff.get(check.key);
      if (!node) {
        if (check.absentMeans === 'pass') return { status: 'pass', message: `未设置 ${check.key}，沿用内核默认值`, evidence: [] };
        return {
          status: 'fail',
          message: `未设置 ${check.key}，未显式加固`,
          evidence: [],
          observed: '未设置',
          expected: String(check.value),
          targets: targets(check.key, check.value),
        };
      }
      const actual = node.args[0] ?? '';
      const ok = eqLoose(actual, check.value);
      const evidence = [evidenceOf(node)];
      for (const s of shadowing(model, check.key)) evidence.push(evidenceOf(s, '该值被后续同名设置覆盖，请清理重复项'));
      return {
        status: ok ? 'pass' : 'fail',
        message: ok ? `${check.key} = ${actual}，符合要求` : `${check.key} = ${actual || '(空)'}，应为 ${check.value}`,
        evidence,
        observed: actual,
        expected: String(check.value),
        targets: ok ? undefined : targets(check.key, check.value, node),
      };
    }
    case 'sysctlNumeric': {
      const node = eff.get(check.key);
      if (!node) {
        if (check.absentMeans === 'pass') return { status: 'pass', message: `未设置 ${check.key}`, evidence: [] };
        return {
          status: 'fail',
          message: `未设置 ${check.key}`,
          evidence: [],
          observed: '未设置',
          expected: `${check.op} ${check.value}`,
          targets: targets(check.key, check.value),
        };
      }
      const actual = node.args[0] ?? '';
      const num = numericSysctl(actual);
      if (num === null) {
        return {
          status: 'fail',
          message: `${check.key} 的值 ${actual} 不是数字`,
          evidence: [evidenceOf(node)],
          observed: actual,
          expected: `${check.op} ${check.value}`,
          targets: targets(check.key, check.value, node),
        };
      }
      const ok = compareNumeric(num, check.op, check.value);
      const evidence = [evidenceOf(node)];
      for (const s of shadowing(model, check.key)) evidence.push(evidenceOf(s, '重复设置'));
      return {
        status: ok ? 'pass' : 'fail',
        message: ok ? `${check.key} = ${actual}，满足 ${check.op} ${check.value}` : `${check.key} = ${actual}，不满足 ${check.op} ${check.value}`,
        evidence,
        observed: actual,
        expected: `${check.op} ${check.value}`,
        targets: ok ? undefined : targets(check.key, check.value, node),
      };
    }
    case 'sysctlOneOf': {
      const node = eff.get(check.key);
      if (!node) {
        if (check.absentMeans === 'pass') return { status: 'pass', message: `未设置 ${check.key}`, evidence: [] };
        return {
          status: 'fail',
          message: `未设置 ${check.key}`,
          evidence: [],
          observed: '未设置',
          expected: check.values.join(' | '),
          targets: targets(check.key, check.values[0]),
        };
      }
      const actual = node.args[0] ?? '';
      const ok = check.values.some((v) => eqLoose(actual, v));
      return {
        status: ok ? 'pass' : 'fail',
        message: ok ? `${check.key} = ${actual}，在允许集合内` : `${check.key} = ${actual}，应取 ${check.values.join(' / ')}`,
        evidence: [evidenceOf(node)],
        observed: actual,
        expected: check.values.join(' | '),
        targets: ok ? undefined : targets(check.key, check.values[0], node),
      };
    }
    default:
      throw new Error(`sysctl 评估器不支持检查类型 ${check.type}`);
  }
}
