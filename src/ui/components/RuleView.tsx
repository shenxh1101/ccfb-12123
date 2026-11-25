import type { RuleCheck, RuleDefinition, RuleSamples } from '../../engine/types';
import { SEVERITY_LABEL } from '../../engine/types';
import { kindLabel } from '../../engine/scanner';
import { Icon, SeverityBadge } from './primitives';

/** Compact one-line rendering of a declarative check, e.g. `PermitRootLogin ∈ [no]`. */
export function describeCheck(check: RuleCheck): string {
  switch (check.type) {
    case 'sshdValue':
      return `sshd ${check.key} ${check.equals !== undefined ? `= ${check.equals}` : check.in ? `∈ {${check.in.join(' | ')}}` : check.matches ? `匹配 /${check.matches}/` : ''}`;
    case 'sshdAbsent':
      return `sshd 未配置 ${check.key}`;
    case 'sshdPresent':
      return `sshd 存在 ${check.key}`;
    case 'sshdNumeric':
      return `sshd ${check.key} ${check.op} ${check.value}`;
    case 'sshdListSubset':
      return `sshd ${check.key} ⊆ {${check.allowed.join(', ')}}${check.require?.length ? ` 且包含 ${check.require.join(', ')}` : ''}`;
    case 'sshdListExcludes':
      return `sshd ${check.key} 不含 {${check.forbidden.join(', ')}}`;
    case 'sysctlEquals':
      return `sysctl ${check.key} = ${check.value}`;
    case 'sysctlNumeric':
      return `sysctl ${check.key} ${check.op} ${check.value}`;
    case 'sysctlOneOf':
      return `sysctl ${check.key} ∈ {${check.values.join(', ')}}`;
    case 'nginxServerValue': {
      const scope = check.scope === 'ssl' ? ' (TLS 站点)' : '';
      const cond = check.equals ?? (check.in ? `∈ {${check.in.join(', ')}}` : check.subsetOf ? `⊆ {${check.subsetOf.join(', ')}}` : check.matches ? `匹配 /${check.matches}/` : '');
      return `nginx server 块 ${check.key} ${cond}${scope}`;
    }
    case 'nginxServerHeader':
      return `nginx server 响应头 ${check.name}${check.valueMatches ? ` 匹配 /${check.valueMatches}/` : ''}`;
    case 'nginxServerCipher':
      return `nginx ${check.key} 不含 {${check.forbidden.join(', ')}}`;
    case 'nginxServerFile':
      return `nginx ${check.key} 指向存在的文件`;
    case 'nginxHttpValue':
      return `nginx http 块 ${check.key} ${check.equals ?? (check.in ? `∈ {${check.in.join(', ')}}` : '')}`;
    case 'nginxLocationValue':
      return `nginx location 块 ${check.key} = ${check.equals ?? ''}`;
    case 'nginxOrphanIncludes':
      return `${check.dir} 无未引用文件`;
    case 'allOf':
      return check.checks.map(describeCheck).join(' 且 ');
    case 'anyOf':
      return check.checks.map(describeCheck).join(' 或 ');
    case 'not':
      return `非（${describeCheck(check.check)}）`;
    default:
      return '';
  }
}

function checkJson(check: RuleCheck, indent: number): string {
  return JSON.stringify(check, null, 2)
    .split('\n')
    .map((l, i) => (i === 0 ? l : ' '.repeat(indent) + l))
    .join('\n');
}

export function ruleToYamlish(rule: RuleDefinition): string {
  const str = (v: string) => (/[:#{}[\]"]/.test(v) || v.includes(' ') ? `"${v.replace(/"/g, '\\"')}"` : v);
  const lines: string[] = [];
  lines.push(`id: ${rule.id}`);
  lines.push(`title: ${str(rule.title)}`);
  lines.push(`kind: ${rule.kind}`);
  lines.push(`category: ${str(rule.category)}`);
  lines.push(`severity: ${rule.severity}`);
  lines.push(`reference: ${str(rule.reference ?? '')}`);
  lines.push('check:');
  lines.push(checkJson(rule.check, 2));
  if (rule.fix) {
    lines.push('fix:');
    lines.push(JSON.stringify(rule.fix, null, 2).split('\n').map((l, i) => (i === 0 ? l : '  ' + l)).join('\n'));
  }
  lines.push(`remediation: ${str(rule.remediation)}`);
  lines.push(`samples: # pass ${rule.samples?.pass.length ?? 0} / fail ${rule.samples?.fail.length ?? 0}`);
  return lines.join('\n');
}

/** Tiny JSON highlighter for the rule definition viewer. */
export function JsonBlock({ text }: { text: string }) {
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"(\s*:)?/g, (_m, p1, p2) => (p2 ? `<span class="tok-key">"${p1}"</span><span class="tok-punct">:</span>` : `<span class="tok-str">"${p1}"</span>`))
    .replace(/\b(true|false)\b/g, '<span class="tok-bool">$1</span>')
    .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  return <pre className="yaml" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function PatchDiff({ samples }: { samples: RuleSamples | undefined }) {
  if (!samples) return <div className="faint small">该规则未附带样例。</div>;
  const render = (title: string, ok: boolean, patches: RuleSamples['pass'], note?: string) => (
    <div className="sample">
      <header>
        <Icon name={ok ? 'check' : 'x'} size={13} style={{ color: ok ? 'var(--pass)' : 'var(--critical)' }} />
        {title}
      </header>
      <div className="body">
        {patches.length === 0 ? '（使用基础样例，无需补丁）' : null}
        {patches.map((p, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ color: 'var(--text-faint)' }}>{p.file}</div>
            {p.find !== undefined ? (
              <>
                <div style={{ color: 'var(--critical)' }}>- {p.find}</div>
                {p.replace ? <div style={{ color: 'var(--pass)' }}>+ {p.replace}</div> : <div className="faint">（删除该行）</div>}
              </>
            ) : null}
            {p.append ? <div style={{ color: 'var(--pass)' }}>+ {p.append.trim()}</div> : null}
          </div>
        ))}
        {note ? <div className="faint" style={{ marginTop: 6 }}>{note}</div> : null}
      </div>
    </div>
  );
  return (
    <div className="sample-grid">
      {render('通过样例', true, samples.pass, samples.passNote)}
      {render('不通过样例', false, samples.fail, samples.failNote)}
    </div>
  );
}

export function RuleMeta({ rule }: { rule: RuleDefinition }) {
  return (
    <div className="def-grid">
      <div className="def">
        <div className="k">规则 ID</div>
        <div className="v mono">{rule.id}</div>
      </div>
      <div className="def">
        <div className="k">配置类型</div>
        <div className="v">{kindLabel(rule.kind)}</div>
      </div>
      <div className="def">
        <div className="k">严重级别</div>
        <div className="v"><SeverityBadge severity={rule.severity} /> <span className="faint small">{SEVERITY_LABEL[rule.severity]}</span></div>
      </div>
      <div className="def">
        <div className="k">分类</div>
        <div className="v">{rule.category}</div>
      </div>
      <div className="def">
        <div className="k">标准依据</div>
        <div className="v">{rule.reference ?? '—'}</div>
      </div>
      <div className="def">
        <div className="k">判定表达式</div>
        <div className="v mono" style={{ fontSize: 11.5 }}>{describeCheck(rule.check)}</div>
      </div>
    </div>
  );
}
