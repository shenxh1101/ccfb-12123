import type { ConfigFileModel, ConfigNode, RuleCheck, RuleFixSpec } from '../types';
import { sshEffective } from '../parsers/sshd';
import { compareNumeric, eq, evidenceOf, type EvalOutcome, type FixTarget } from './common';

function desiredFromCheck(check: RuleCheck, fix?: RuleFixSpec): string[] | null {
  if (fix?.args?.length) return fix.args;
  if (check.type === 'sshdValue') {
    if (check.equals !== undefined) return [check.equals];
    if (check.in?.length) return [check.in[0]];
    if (check.matches) {
      // Extract a literal sample from simple patterns such as `^(yes|no)$`.
      const alt = check.matches.match(/^\^?\(([^)]+)\)\$?$/);
      if (alt) return [alt[1].split('|')[0]];
    }
  }
  if (check.type === 'sshdPresent') return [];
  return null;
}

function targetFile(model: ConfigFileModel, fix?: RuleFixSpec): string {
  if (fix?.file && model.availableFiles.includes(fix.file)) return fix.file;
  return model.root;
}

function absentOutcome(check: { absentMeans?: 'pass' | 'fail'; note?: string }, key: string, model: ConfigFileModel, fix?: RuleFixSpec): EvalOutcome {
  const note = check.note ?? `未显式配置 ${key}，使用 OpenSSH 默认值`;
  if (check.absentMeans === 'pass') return { status: 'pass', message: note, evidence: [] };
  const args = desiredFromCheck({ type: 'sshdValue', key }, fix);
  const targets: FixTarget[] | undefined = args
    ? [{ key, args, fallbackFile: targetFile(model, fix), note: '在全局作用域追加显式配置' }]
    : undefined;
  return { status: 'fail', message: note, evidence: [], targets };
}

/** Match blocks that mention a key, for advisory evidence. */
function matchOverrides(model: ConfigFileModel, key: string): ConfigNode[] {
  const lk = key.toLowerCase();
  return model.flat.filter((n) => n.block.length > 0 && n.key !== 'Match' && n.key.toLowerCase() === lk);
}

function listOf(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function evalSshdCheck(check: RuleCheck, model: ConfigFileModel, fix?: RuleFixSpec): EvalOutcome {
  const eff = sshEffective(model);
  switch (check.type) {
    case 'sshdValue': {
      const node = eff.get(check.key.toLowerCase());
      if (!node) return absentOutcome(check, check.key, model, fix);
      const actual = node.args.join(' ');
      let ok = true;
      if (check.equals !== undefined) ok = eq(actual, check.equals, check.caseInsensitive);
      if (check.in) ok = check.in.some((v) => eq(actual, v, check.caseInsensitive));
      if (check.matches) {
        try {
          ok = new RegExp(check.matches, check.caseInsensitive ? 'i' : '').test(actual);
        } catch {
          ok = false;
        }
      }
      const evidence = [evidenceOf(node)];
      const overrides = matchOverrides(model, check.key);
      for (const o of overrides) evidence.push(evidenceOf(o, '该 Match 块中的取值仅对匹配连接生效'));
      const args = desiredFromCheck(check, fix);
      return {
        status: ok ? 'pass' : 'fail',
        message: ok
          ? `${check.key} = ${actual}，符合要求`
          : `${check.key} = ${actual || '(空)'}，应为 ${check.equals ?? check.in?.join(' / ') ?? check.matches}`,
        evidence,
        observed: actual,
        expected: check.equals ?? check.in?.join(' | ') ?? check.matches,
        targets: !ok && args ? [{ key: check.key, args, node, fallbackFile: node.file }] : undefined,
      };
    }
    case 'sshdAbsent': {
      const node = eff.get(check.key.toLowerCase());
      if (!node) {
        return { status: 'pass', message: `未配置 ${check.key}（安全默认）`, evidence: [], observed: '未配置' };
      }
      return {
        status: 'fail',
        message: `配置了 ${check.key} ${node.args.join(' ')}，建议移除或以安全值显式覆盖`,
        evidence: [evidenceOf(node)],
        observed: node.args.join(' '),
        expected: '未配置 / 禁用',
        targets: [{ key: check.key, args: [], node, remove: true, fallbackFile: node.file }],
      };
    }
    case 'sshdPresent': {
      const node = eff.get(check.key.toLowerCase());
      if (node) return { status: 'pass', message: `${check.key} 已配置`, evidence: [evidenceOf(node)], observed: node.args.join(' ') };
      return {
        status: 'fail',
        message: `${check.key} 未配置`,
        evidence: [],
        observed: '未配置',
        targets: fix?.args?.length ? [{ key: check.key, args: fix.args, fallbackFile: targetFile(model, fix) }] : undefined,
      };
    }
    case 'sshdNumeric': {
      const node = eff.get(check.key.toLowerCase());
      if (!node) {
        if (check.absentMeans === 'pass') {
          return { status: 'pass', message: `未配置 ${check.key}，沿用默认值`, evidence: [] };
        }
        const args = fix?.args?.length ? fix.args : [String(check.value)];
        return {
          status: 'fail',
          message: `未配置 ${check.key}`,
          evidence: [],
          observed: '未配置',
          expected: `${check.op} ${check.value}`,
          targets: [{ key: check.key, args, fallbackFile: targetFile(model, fix) }],
        };
      }
      const raw = node.args[0] ?? '';
      const num = parseNumber(raw);
      if (num === null) {
        return {
          status: 'fail',
          message: `${check.key} 的值 ${raw} 不是可比较的数字`,
          evidence: [evidenceOf(node)],
          observed: raw,
          expected: `${check.op} ${check.value}`,
          targets: fix?.args?.length ? [{ key: check.key, args: fix.args, node, fallbackFile: node.file }] : undefined,
        };
      }
      const ok = compareNumeric(num, check.op, check.value);
      const args = fix?.args?.length ? fix.args : [String(check.value)];
      return {
        status: ok ? 'pass' : 'fail',
        message: ok ? `${check.key} = ${raw}，满足 ${check.op} ${check.value}` : `${check.key} = ${raw}，不满足 ${check.op} ${check.value}`,
        evidence: [evidenceOf(node)],
        observed: raw,
        expected: `${check.op} ${check.value}`,
        targets: ok ? undefined : [{ key: check.key, args, node, fallbackFile: node.file }],
      };
    }
    case 'sshdListSubset': {
      const node = eff.get(check.key.toLowerCase());
      if (!node) return absentOutcome(check, check.key, model, fix);
      const values = listOf(node.args.join(' ')).map((v) => v.toLowerCase());
      const allowed = new Set(check.allowed.map((v) => v.toLowerCase()));
      const bad = values.filter((v) => !allowed.has(v));
      const missing = (check.require ?? []).filter((r) => !values.includes(r.toLowerCase()));
      const ok = bad.length === 0 && missing.length === 0;
      const parts: string[] = [];
      if (bad.length) parts.push(`包含不允许的取值 ${bad.join(', ')}`);
      if (missing.length) parts.push(`缺少必需取值 ${missing.join(', ')}`);
      const kept = values.filter((v) => allowed.has(v));
      const desired = [...new Set([...kept, ...(check.require ?? []).map((r) => r.toLowerCase())])];
      return {
        status: ok ? 'pass' : 'fail',
        message: ok ? `${check.key} 取值合规` : `${check.key} ${parts.join('；')}`,
        evidence: [evidenceOf(node)],
        observed: values.join(', '),
        expected: check.allowed.join(', '),
        targets: ok ? undefined : [{ key: check.key, args: [desired.join(',')], node, fallbackFile: node.file }],
      };
    }
    case 'sshdListExcludes': {
      const node = eff.get(check.key.toLowerCase());
      if (!node) return absentOutcome(check, check.key, model, fix);
      const values = listOf(node.args.join(' ')).map((v) => v.toLowerCase());
      const hit = values.filter((v) => check.forbidden.map((f) => f.toLowerCase()).includes(v));
      const kept = values.filter((v) => !hit.includes(v));
      return {
        status: hit.length ? 'fail' : 'pass',
        message: hit.length ? `${check.key} 包含不安全算法 ${hit.join(', ')}` : `${check.key} 未包含禁用算法`,
        evidence: [evidenceOf(node)],
        observed: values.join(', '),
        expected: `不包含 ${check.forbidden.join(', ')}`,
        targets: hit.length && kept.length ? [{ key: check.key, args: [kept.join(',')], node, fallbackFile: node.file }] : undefined,
      };
    }
    default:
      throw new Error(`sshd 评估器不支持检查类型 ${check.type}`);
  }
}

function parseNumber(raw: string): number | null {
  const v = raw.trim();
  if (/^-?\d+$/.test(v)) return Number.parseInt(v, 10);
  const m = v.match(/^(\d+)([mhd])$/);
  if (!m) return null;
  const mult = ({ m: 1, h: 60, d: 1440 } as Record<string, number>)[m[2]];
  return Number.parseInt(m[1], 10) * mult;
}
