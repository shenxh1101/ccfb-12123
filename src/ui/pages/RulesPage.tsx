import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import type { RuleDefinition, RuleFile, Severity, ConfigKind, RuleResult } from '../../engine/types';
import { SEVERITY_LABEL, SEVERITY_ORDER } from '../../engine/types';
import { validateRuleFile } from '../../engine/scanner';
import { describeCheck, ruleToYamlish, JsonBlock, PatchDiff, RuleMeta } from '../components/RuleView';
import { Icon, EmptyState, SeverityBadge, StatusBadge } from '../components/primitives';
import { BASE_BUNDLES } from '../../data/base';
import { applyPatches, makeBundle } from '../../engine/fixtures';
import { scanHost } from '../../engine/scanner';
import type { AppPage } from '../../App';

interface SampleRun {
  ruleId: string;
  pass: RuleResult;
  fail: RuleResult;
  ok: boolean;
  builtAt: number;
}

function ruleFromHash(): string | null {
  const hash = window.location.hash;
  const m = hash.match(/[?&]rule=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function RulesPage({ go }: { go: (p: AppPage) => void }) {
  const { state, dispatch, notify } = useStore();
  const [kind, setKind] = useState<ConfigKind | 'all'>('all');
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(() => ruleFromHash());
  const [tab, setTab] = useState<'definition' | 'samples' | 'json'>('definition');
  const [runs, setRuns] = useState<Record<string, SampleRun>>({});
  const [runningAll, setRunningAll] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const rules = state.rules;
  const filtered = useMemo(
    () =>
      rules.filter((r) => {
        if (kind !== 'all' && r.kind !== kind) return false;
        if (severity !== 'all' && r.severity !== severity) return false;
        if (query) {
          const q = query.toLowerCase();
          return (
            r.id.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            (r.reference ?? '').toLowerCase().includes(q) ||
            describeCheck(r.check).toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [rules, kind, severity, query],
  );

  const current = rules.find((r) => r.id === selected) ?? filtered[0] ?? null;

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rules) map.set(r.category, (map.get(r.category) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rules]);

  function runSample(rule: RuleDefinition): SampleRun {
    const base = makeBundle(`sample-${rule.id}`, BASE_BUNDLES[rule.kind].files, 'sample-suite');
    const passing = scanHost(base, [rule], [rule.kind]).results[0];
    let failing: RuleResult;
    try {
      const patched = applyPatches(base, rule.samples?.fail ?? []);
      failing = scanHost(patched, [rule], [rule.kind]).results[0];
    } catch (err) {
      failing = {
        ...passing,
        status: 'error',
        message: `样例补丁无法应用：${(err as Error).message}`,
      };
    }
    const ok = passing.status === 'pass' && (failing.status === 'fail' || failing.status === 'warn');
    return { ruleId: rule.id, pass: passing, fail: failing, ok, builtAt: Date.now() };
  }

  function runAll() {
    setRunningAll(true);
    // Defer so the button paints its busy state before the synchronous loop.
    setTimeout(() => {
      const next: Record<string, SampleRun> = {};
      for (const r of rules) next[r.id] = runSample(r);
      setRuns(next);
      setRunningAll(false);
      const bad = rules.filter((r) => next[r.id] && !next[r.id].ok);
      if (bad.length) notify('error', `${bad.length} 条规则的样例未按预期通过/失败：${bad.map((b) => b.id).join(', ')}`);
      else notify('ok', `${rules.length} 条规则的通过/不通过样例全部符合预期`);
    }, 30);
  }

  async function importRules(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as RuleFile;
      const { rules: valid, errors } = validateRuleFile(parsed);
      if (errors.length) {
        notify('error', `规则文件有 ${errors.length} 处错误：${errors.slice(0, 2).join('；')}`);
        return;
      }
      dispatch({ type: 'setRules', rules: valid, file: { ...parsed, rules: valid } });
      setRuns({});
      notify('ok', `已加载规则文件 ${file.name}，共 ${valid.length} 条`);
    } catch (err) {
      notify('error', `规则文件解析失败：${(err as Error).message}`);
    }
  }

  function downloadRules() {
    const json = JSON.stringify(state.ruleFile, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'baseline-rules.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Support deep links such as #/rules?rule=SSH-001 from the scan results page.
  useEffect(() => {
    const onHash = () => {
      const id = ruleFromHash();
      if (id) setSelected(id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const sampleRun = current ? runs[current.id] : undefined;

  return (
    <div className="stack-lg">
      <div className="topbar">
        <div>
          <h1 className="page-title">检查项</h1>
          <p className="page-sub">
            规则文件驱动 · {rules.length} 条规则 · 覆盖 {categories.length} 个分类 · 每条规则附带可通过与不通过的样例
          </p>
        </div>
        <div className="topbar-actions">
          <label className="btn">
            <Icon name="upload" size={15} /> 导入规则文件
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importRules(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
          <button className="btn" onClick={downloadRules}><Icon name="download" size={15} /> 导出规则</button>
          <button className="btn" onClick={runAll} disabled={runningAll || !rules.length}>
            <Icon name="play" size={15} /> {runningAll ? '运行中…' : '校验全部样例'}
          </button>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="stat accent">
          <div className="k">规则总数</div>
          <div className="v">{rules.length}</div>
          <div className="sub">{state.ruleFile.name}</div>
        </div>
        {(['critical', 'high', 'medium'] as Severity[]).map((s) => (
          <div className="stat" key={s}>
            <div className="k">{SEVERITY_LABEL[s]}级规则</div>
            <div className="v">{rules.filter((r) => r.severity === s).length}</div>
            <div className="sub">{rules.filter((r) => r.severity === s).length} 条需优先处置</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" />
            <input className="input" placeholder="搜索规则 ID / 标题 / 指令" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="chips">
            <button className={`chip ${kind === 'all' ? 'on' : ''}`} onClick={() => setKind('all')}>全部类型<span className="c">{rules.length}</span></button>
            {(['sshd', 'nginx', 'sysctl'] as ConfigKind[]).map((k) => (
              <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                {{ sshd: 'SSH', nginx: 'Nginx', sysctl: '内核' }[k]}
                <span className="c">{rules.filter((r) => r.kind === k).length}</span>
              </button>
            ))}
          </div>
          <div className="spacer" />
          <div className="chips">
            <button className={`chip ${severity === 'all' ? 'on' : ''}`} onClick={() => setSeverity('all')}>全部级别</button>
            {SEVERITY_ORDER.filter((s) => s !== 'info').map((s) => (
              <button key={s} className={`chip ${severity === s ? 'on' : ''}`} onClick={() => setSeverity(s)}>
                {SEVERITY_LABEL[s]}
                <span className="c">{rules.filter((r) => r.severity === s).length}</span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="rules" title="没有匹配的规则">
            试试清空搜索或切换类型筛选。也可以导入自定义规则文件，格式见右侧 JSON 示例。
          </EmptyState>
        ) : (
          <div className="split rules-split" style={{ padding: 14 }}>
            <div className="table-wrap" style={{ maxHeight: '68vh', overflow: 'auto' }}>
              <table className="table compact">
                <thead>
                  <tr>
                    <th>规则</th>
                    <th>级别</th>
                    <th>分类</th>
                    <th>样例</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const run = runs[r.id];
                    return (
                      <tr
                        key={r.id}
                        className="clickable"
                        style={current?.id === r.id ? { background: 'var(--bg-elev-3)' } : undefined}
                        onClick={() => setSelected(r.id)}
                      >
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            <span className="badge plain mono">{r.id}</span>
                          </div>
                          <div style={{ marginTop: 3, fontWeight: 550 }}>{r.title}</div>
                          <div className="faint tiny mono" style={{ marginTop: 2 }}>{describeCheck(r.check)}</div>
                        </td>
                        <td><SeverityBadge severity={r.severity} /></td>
                        <td className="small dim" style={{ whiteSpace: 'nowrap' }}>{r.category}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {run ? (
                            <span className={`badge ${run.ok ? 'st-pass' : 'st-error'}`} title={run.ok ? '通过/不通过样例均符合预期' : '样例结果与预期不符'}>
                              <i className="dot" />{run.ok ? '正常' : '异常'}
                            </span>
                          ) : (
                            <span className={`badge ${r.samples ? 'plain' : 'st-warn'}`} title="已内置通过/不通过样例">
                              {r.samples ? '2 组' : '缺失'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {current ? (
              <div className="card" style={{ position: 'sticky', top: 14 }}>
                <div className="card-head">
                  <span className="badge plain mono">{current.id}</span>
                  <h3 className="card-title">{current.title}</h3>
                  <div className="spacer" />
                  <SeverityBadge severity={current.severity} />
                  <button
                    className="btn sm"
                    onClick={() => setRuns((prev) => ({ ...prev, [current.id]: runSample(current) }))}
                  >
                    <Icon name="play" size={12} /> 运行样例
                  </button>
                </div>
                <div className="tabs" style={{ margin: '12px 16px 0' }}>
                  <button className={`tab ${tab === 'definition' ? 'on' : ''}`} onClick={() => setTab('definition')}>规则定义</button>
                  <button className={`tab ${tab === 'samples' ? 'on' : ''}`} onClick={() => setTab('samples')}>通过 / 不通过样例</button>
                  <button className={`tab ${tab === 'json' ? 'on' : ''}`} onClick={() => setTab('json')}>规则 JSON</button>
                </div>
                <div className="card-pad stack">
                  {tab === 'definition' ? (
                    <>
                      <div className="small dim">{current.description}</div>
                      <RuleMeta rule={current} />
                      <div>
                        <div className="faint tiny" style={{ marginBottom: 4, letterSpacing: 0.6, textTransform: 'uppercase' }}>修复建议</div>
                        <div className="small">{current.remediation}</div>
                      </div>
                      {current.fix ? (
                        <div>
                          <div className="faint tiny" style={{ marginBottom: 4, letterSpacing: 0.6, textTransform: 'uppercase' }}>自动修复模板</div>
                          <code className="snippet">{JSON.stringify(current.fix)}</code>
                        </div>
                      ) : null}
                      <div>
                        <div className="faint tiny" style={{ marginBottom: 4, letterSpacing: 0.6, textTransform: 'uppercase' }}>声明式规则（YAML 风格）</div>
                        <pre className="yaml">{ruleToYamlish(current)}</pre>
                      </div>
                    </>
                  ) : null}

                  {tab === 'samples' ? (
                    <>
                      <div className="small dim">
                        样例以补丁形式作用于内置基础配置：<b style={{ color: 'var(--text)' }}>通过样例</b> 为基础配置，应判定为“通过”；
                        <b style={{ color: 'var(--text)' }}>不通过样例</b> 先应用下列改动，应判定为“不通过”。
                      </div>
                      <PatchDiff samples={current.samples} />
                      {sampleRun ? (
                        <div className="stack" style={{ gap: 8 }}>
                          <div className="row">
                            <span className={`badge ${sampleRun.ok ? 'st-pass' : 'st-error'}`}>
                              <i className="dot" />{sampleRun.ok ? '样例校验通过' : '样例校验异常'}
                            </span>
                            <span className="faint tiny">实际运行结果如下</span>
                          </div>
                          <div className="sample">
                            <header><Icon name="check" size={13} style={{ color: 'var(--pass)' }} /> 通过样例的扫描结果</header>
                            <div className="body">
                              <StatusBadge status={sampleRun.pass.status} /> {sampleRun.pass.message}
                            </div>
                          </div>
                          <div className="sample">
                            <header><Icon name="x" size={13} style={{ color: 'var(--critical)' }} /> 不通过样例的扫描结果</header>
                            <div className="body">
                              <StatusBadge status={sampleRun.fail.status} /> {sampleRun.fail.message}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="faint small">点击右上角“运行样例”，会在内存中应用补丁并实际扫描一遍。</div>
                      )}
                    </>
                  ) : null}

                  {tab === 'json' ? <JsonBlock text={JSON.stringify(current, null, 2)} /> : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="row" style={{ marginBottom: 10 }}>
          <Icon name="info" size={15} style={{ color: 'var(--accent)' }} />
          <b>规则文件格式</b>
          <div className="spacer" />
          <button className="btn sm ghost" onClick={() => go('import')}>
            <Icon name="import" size={13} /> 去导入配置
          </button>
        </div>
        <div className="small dim" style={{ marginBottom: 10 }}>
          规则文件是纯 JSON：<span className="mono">{'{ version, name, rules[] }'}</span>。每条规则含 id / title / category / severity / kind / check / remediation，
          可选 fix（自动修复参数）与 samples（通过、不通过补丁）。check 是声明式表达式，支持
          <span className="mono"> sshdValue、sshdNumeric、sshdListExcludes、sysctlEquals、sysctlNumeric、nginxServerValue、nginxServerHeader、nginxServerCipher、nginxServerFile、nginxLocationValue、nginxOrphanIncludes、allOf/anyOf/not</span> 等类型。
        </div>
        <pre className="yaml" style={{ maxHeight: 260 }}>{`{
  "version": 1,
  "name": "我的规则集",
  "rules": [
    {
      "id": "SSH-001",
      "title": "禁止 root 直接登录",
      "kind": "sshd",
      "category": "SSH 访问控制",
      "severity": "critical",
      "remediation": "设置 PermitRootLogin no",
      "check": { "type": "sshdValue", "key": "PermitRootLogin", "in": ["no"], "absentMeans": "fail" },
      "fix": { "args": ["no"] },
      "samples": {
        "pass": [],
        "fail": [{ "file": "/etc/ssh/sshd_config", "find": "PermitRootLogin no", "replace": "PermitRootLogin yes" }]
      }
    }
  ]
}`}</pre>
      </div>
    </div>
  );
}
