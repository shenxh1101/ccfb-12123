import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { AppPage } from '../../App';
import type { DiffLine } from '../../engine/types';
import { buildRemediation, remediationStats } from '../../engine/remediation';
import { makeBundle } from '../../engine/fixtures';
import { scanHost } from '../../engine/scanner';
import { formatDuration } from '../../engine/paths';
import { Icon, EmptyState, SeverityBadge } from '../components/primitives';

export function RemediationPage({ go }: { go: (p: AppPage) => void }) {
  const { state, dispatch, notify } = useStore();
  const [hostFilter, setHostFilter] = useState<string>('all');
  const [active, setActive] = useState<string | null>(null);
  const [view, setView] = useState<'diff' | 'patched' | 'original'>('diff');
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [rescanning, setRescanning] = useState(false);

  const hostResults = useMemo(
    () => state.order.map((n) => state.results[n]).filter(Boolean),
    [state.order, state.results],
  );
  const fixableResults = useMemo(
    () => hostResults.flatMap((h) => h.results.filter((r) => r.fix && (r.status === 'fail' || r.status === 'warn')).map((r) => ({ host: h.host, rule: r }))),
    [hostResults],
  );

  const files = useMemo(() => {
    if (!state.remediation.length) return [];
    return state.remediation;
  }, [state.remediation]);

  const visible = files.filter((f) => hostFilter === 'all' || f.host === hostFilter);
  const activeFile = visible.find((f) => `${f.host}:${f.file}` === active) ?? visible[0] ?? null;
  const stats = remediationStats(files);

  function regenerate(ruleFilter?: Set<string>) {
    const built = hostResults.flatMap((h) => {
      const entry = state.hosts.find((x) => x.bundle.name === h.host);
      if (!entry) return [];
      return buildRemediation(entry.bundle, h.results, ruleFilter ? { ruleIds: ruleFilter } : {});
    });
    dispatch({ type: 'setRemediation', files: built });
    return built;
  }

  /** Apply the patches to the in-memory bundles and re-run the whole rule set. */
  function rescanFixed() {
    if (!files.length) return;
    setRescanning(true);
    setTimeout(() => {
      try {
        const started = performance.now();
        const results = [];
        const order: string[] = [];
        for (const entry of state.hosts) {
          const original = entry.bundle;
          const fileMap = new Map(original.files);
          const orderList = [...original.order];
          for (const f of files.filter((x) => x.host === original.name)) {
            if (f.original) {
              fileMap.set(f.file, { path: f.file, content: f.patched, size: new Blob([f.patched]).size });
            } else {
              fileMap.set(f.file, { path: f.file, content: f.patched, size: new Blob([f.patched]).size });
              if (!orderList.includes(f.file)) orderList.push(f.file);
            }
          }
          orderList.sort();
          const bundle = makeBundle(
            original.name,
            orderList.map((p) => ({ relativePath: p, content: fileMap.get(p)?.content ?? '' })),
            entry.source,
          );
          const result = scanHost(bundle, state.rules, ['sshd', 'nginx', 'sysctl']);
          results.push(result);
          order.push(result.host);
        }
        dispatch({ type: 'setFixed', results, order, at: performance.now() });
        notify('ok', `已用修复后的配置重新扫描，用时 ${formatDuration(performance.now() - started)}`);
      } catch (err) {
        notify('error', `重新扫描失败：${(err as Error).message}`);
      } finally {
        setRescanning(false);
      }
    }, 30);
  }

  function downloadFixes() {
    for (const f of files) {
      const blob = new Blob([f.patched], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${f.host}${f.file.replace(/\//g, '_')}`;
      a.click();
      URL.revokeObjectURL(url);
    }
    notify('ok', `已导出 ${files.length} 个修复后的配置文件`);
  }

  const fixedPairs = state.fixedOrder
    .map((name) => ({
      before: state.results[name],
      after: state.fixedResults[name],
    }))
    .filter((p) => p.before && p.after);

  if (!state.order.length) {
    return (
      <div className="card">
        <EmptyState icon="wrench" title="还没有扫描结果" action={<button className="btn primary" onClick={() => go('scan')}><Icon name="scan" size={15} /> 去扫描</button>}>
          先执行一次扫描，系统会根据未通过项自动生成修复后的配置文件。
        </EmptyState>
      </div>
    );
  }

  if (!files.length) {
    return (
      <div className="stack-lg">
        <div className="topbar">
          <div>
            <h1 className="page-title">整改建议</h1>
            <p className="page-sub">根据未通过项自动生成修复后的配置文件，并可一键重新扫描验证</p>
          </div>
        </div>
        <div className="card">
          <EmptyState
            icon="wrench"
            title={fixableResults.length ? `${fixableResults.length} 项可自动修复` : '没有需要整改的项'}
            action={
              <button className="btn primary" onClick={() => { const built = regenerate(); if (built.length) notify('ok', `已生成 ${built.length} 个修复文件`); else notify('warn', '这些未通过项无法自动修复，请按修复建议手工处理'); }}>
                <Icon name="sparkle" size={15} /> 生成整改方案
              </button>
            }
          >
            {fixableResults.length
              ? `共 ${fixableResults.length} 条未通过/告警项带有可执行的修复参数，点击生成即可看到修改后的完整配置文件与差异。`
              : '当前所有主机均通过检查，或未通过项只能人工处理。'}
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <div className="topbar">
        <div>
          <h1 className="page-title">整改建议</h1>
          <p className="page-sub">
            {stats.files} 个文件 · 覆盖 {stats.rules} 条规则 · +{stats.added} / -{stats.removed} 行
          </p>
        </div>
        <div className="topbar-actions">
          <select className="select" style={{ width: 150 }} value={hostFilter} onChange={(e) => setHostFilter(e.target.value)}>
            <option value="all">全部主机</option>
            {[...new Set(files.map((f) => f.host))].map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <button className="btn" onClick={() => { regenerate(); notify('info', '已按当前扫描结果重新生成'); }}>
            <Icon name="refresh" size={15} /> 重新生成
          </button>
          <button className="btn" onClick={downloadFixes}>
            <Icon name="download" size={15} /> 导出修复文件
          </button>
          <button className="btn primary" onClick={rescanFixed} disabled={rescanning}>
            <Icon name="scan" size={15} /> {rescanning ? '重新扫描中…' : '应用修复并重扫'}
          </button>
        </div>
      </div>

      {state.fixedScanAt ? (
        <div className="card">
          <div className="card-head">
            <Icon name="check" size={15} style={{ color: 'var(--pass)' }} />
            <h3 className="card-title">修复前后对比</h3>
            <div className="spacer" />
            <span className="faint small">重扫时间 {new Date(state.fixedScanAt).toLocaleTimeString()}</span>
            <button className="btn xs ghost" onClick={() => dispatch({ type: 'clearFixed' })}>关闭</button>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table compact">
              <thead>
                <tr>
                  <th>主机</th>
                  <th className="num">修复前评分</th>
                  <th className="num">修复后评分</th>
                  <th className="num">修复前不通过</th>
                  <th className="num">修复后不通过</th>
                  <th>结论</th>
                </tr>
              </thead>
              <tbody>
                {fixedPairs.map(({ before, after }) => {
                  const delta = after.summary.fail - before.summary.fail;
                  return (
                    <tr key={before.host}>
                      <td><b>{before.host}</b></td>
                      <td className="num">{before.summary.score}</td>
                      <td className="num" style={{ color: after.summary.score >= before.summary.score ? 'var(--pass)' : 'var(--critical)' }}>{after.summary.score}</td>
                      <td className="num">{before.summary.fail}</td>
                      <td className="num">{after.summary.fail}</td>
                      <td>
                        {after.summary.fail === 0
                          ? <span className="badge st-pass"><i className="dot" />全部通过</span>
                          : <span className="badge st-warn"><i className="dot" />剩余 {after.summary.fail} 项</span>}
                        {delta < 0 ? <span className="faint small" style={{ marginLeft: 8 }}>减少 {Math.abs(delta)} 项</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card-pad" style={{ paddingTop: 0 }}>
            {fixedPairs.some((p) => p.after.summary.fail > 0) ? (
              <div className="banner warn" style={{ marginTop: 10 }}>
                <Icon name="alert" size={18} className="bicon" />
                <div>
                  仍有未通过项。自动修复只处理能确定安全取值的指令；证书缺失、未加载的配置文件等需要人工处理，详见各主机的重扫结果。
                  {fixedPairs.map((p) => (
                    p.after.summary.fail > 0 ? (
                      <div key={p.before.host} className="small" style={{ marginTop: 4 }}>
                        <b>{p.before.host}</b>：
                        {p.after.results.filter((r) => r.status === 'fail').slice(0, 4).map((r) => `${r.ruleId} ${r.title}`).join('；')}
                      </div>
                    ) : null
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="split">
        <div className="card fix-list">
          <div className="card-head">
            <Icon name="file" size={15} style={{ color: 'var(--accent)' }} />
            <h3 className="card-title">待修改文件</h3>
            <span className="badge plain">{visible.length}</span>
          </div>
          <div className="card-pad stack" style={{ gap: 8 }}>
            {visible.map((f) => {
              const key = `${f.host}:${f.file}`;
              const added = f.diff.filter((d) => d.kind === 'add').length;
              const removed = f.diff.filter((d) => d.kind === 'del').length;
              return (
                <button
                  key={key}
                  className={`filetab ${activeFile && `${activeFile.host}:${activeFile.file}` === key ? 'on' : ''}`}
                  style={{ fontFamily: 'inherit', padding: '9px 11px', alignItems: 'flex-start', flexDirection: 'column', gap: 4, whiteSpace: 'normal' }}
                  onClick={() => setActive(key)}
                >
                  <div className="row" style={{ width: '100%' }}>
                    <span className="badge plain">{f.host}</span>
                    <span className="mono small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file}</span>
                    {!f.original ? <span className="badge st-pass">新建</span> : null}
                    <div className="spacer" />
                    <span className="mono tiny" style={{ color: 'var(--pass)' }}>+{added}</span>
                    <span className="mono tiny" style={{ color: 'var(--critical)' }}>-{removed}</span>
                  </div>
                  <div className="faint tiny">{f.ruleIds.join(' · ')}</div>
                </button>
              );
            })}
            <button
              className="btn sm ghost"
              onClick={() => {
                const all = fixableResults.map((x) => x.rule.ruleId);
                const allSet = new Set(all);
                setSelectedRules((prev) => (prev.size === allSet.size ? new Set() : allSet));
              }}
            >
              <Icon name="filter" size={12} /> 按规则筛选（{fixableResults.length} 条可修复）
            </button>
          </div>
        </div>

        {activeFile ? (
          <div className="card fix-panel">
            <div className="card-head">
              <Icon name="wrench" size={15} style={{ color: 'var(--accent)' }} />
              <h3 className="card-title mono" style={{ fontSize: 12.5 }}>{activeFile.file}</h3>
              <div className="spacer" />
              <div className="tabs">
                <button className={`tab ${view === 'diff' ? 'on' : ''}`} onClick={() => setView('diff')}>差异</button>
                <button className={`tab ${view === 'patched' ? 'on' : ''}`} onClick={() => setView('patched')}>修复后</button>
                <button className={`tab ${view === 'original' ? 'on' : ''}`} onClick={() => setView('original')}>原始</button>
              </div>
            </div>
            <div className="card-pad stack">
              <details className="rule-chips">
                <summary>
                  涉及 {activeFile.ruleIds.length} 条规则
                  <span className="faint small" style={{ marginLeft: 8 }}>
                    {activeFile.ruleIds.slice(0, 3).join(' · ')}
                    {activeFile.ruleIds.length > 3 ? ' …' : ''}
                  </span>
                </summary>
                <div className="row wrap" style={{ marginTop: 8 }}>
                  {activeFile.ruleIds.map((id) => {
                    const rule = state.rules.find((r) => r.id === id);
                    const res = hostResults.find((h) => h.host === activeFile.host)?.results.find((r) => r.ruleId === id);
                    return (
                      <span key={id} className="row" style={{ gap: 5 }}>
                        <span className="badge plain mono">{id}</span>
                        {rule ? <span className="small dim">{rule.title}</span> : null}
                        {res ? <SeverityBadge severity={res.severity} /> : null}
                      </span>
                    );
                  })}
                </div>
              </details>
              {view === 'diff' ? <DiffView lines={activeFile.diff} /> : null}
              {view === 'patched' ? (
                <div className="code" style={{ maxHeight: '58vh' }}>
                  {activeFile.patched.split('\n').map((line, i) => {
                    const changed = activeFile.diff.some((d) => d.kind === 'add' && d.text === line);
                    return (
                      <div key={i} className={`code-line ${changed ? 'add' : ''}`}>
                        <span className="ln">{i + 1}</span>
                        <span className="tx">{line || ' '}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {view === 'original' ? (
                <div className="code" style={{ maxHeight: '58vh' }}>
                  {activeFile.original.split('\n').map((line, i) => {
                    const changed = activeFile.diff.some((d) => d.kind === 'del' && d.text === line);
                    return (
                      <div key={i} className={`code-line ${changed ? 'del' : ''}`}>
                        <span className="ln">{i + 1}</span>
                        <span className="tx">{line || ' '}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="row small dim">
                <Icon name="info" size={13} />
                修复后的文件可直接替换目标机上的同名文件；建议先在测试环境验证，备份原始配置与 /etc 权限。
                <div className="spacer" />
                <button
                  className="btn xs"
                  onClick={() => {
                    void navigator.clipboard?.writeText(activeFile.patched).then(
                      () => notify('ok', '修复后的配置已复制到剪贴板'),
                      () => notify('error', '剪贴板不可用'),
                    );
                  }}
                >
                  <Icon name="copy" size={12} /> 复制
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="card-head">
          <Icon name="scan" size={15} style={{ color: 'var(--accent)' }} />
          <h3 className="card-title">整改清单</h3>
          <div className="spacer" />
          <span className="card-hint">勾选规则后可只生成选中项的修复</span>
        </div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 420, overflow: 'auto' }}>
          <table className="table compact">
            <thead>
              <tr>
                <th style={{ width: 34 }} />
                <th>主机</th>
                <th>规则</th>
                <th>级别</th>
                <th>当前 → 目标</th>
                <th>修改</th>
              </tr>
            </thead>
            <tbody>
              {fixableResults.map(({ host, rule }) => {
                const checked = selectedRules.size === 0 || selectedRules.has(rule.ruleId);
                return (
                  <tr key={`${host}:${rule.ruleId}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedRules((prev) => {
                            const next = new Set(prev.size ? prev : fixableResults.map((x) => x.rule.ruleId));
                            if (next.has(rule.ruleId)) next.delete(rule.ruleId);
                            else next.add(rule.ruleId);
                            return next;
                          });
                        }}
                        aria-label={`选择 ${rule.ruleId}`}
                      />
                    </td>
                    <td><b>{host}</b></td>
                    <td><span className="badge plain mono">{rule.ruleId}</span> <span className="small">{rule.title}</span></td>
                    <td><SeverityBadge severity={rule.severity} /></td>
                    <td className="mono tiny">
                      <span style={{ color: 'var(--critical)' }}>{rule.observed ?? '未配置'}</span>
                      <span className="faint"> → </span>
                      <span style={{ color: 'var(--pass)' }}>{rule.expected ?? '合规值'}</span>
                    </td>
                    <td className="faint tiny">{rule.fix?.summary}</td>
                  </tr>
                );
              })}
              {fixableResults.length === 0 ? (
                <tr><td colSpan={6} className="faint small" style={{ padding: 16 }}>没有可自动修复的项。</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="card-pad row">
          <span className="faint small">
            {selectedRules.size === 0 ? '未选择时表示全部规则' : `已选择 ${selectedRules.size} 条规则`}
          </span>
          <div className="spacer" />
          <button
            className="btn"
            onClick={() => {
              const built = regenerate(selectedRules.size ? selectedRules : undefined);
              notify('ok', `已生成 ${built.length} 个修复文件（${selectedRules.size ? `${selectedRules.size} 条规则` : '全部规则'}）`);
            }}
          >
            应用筛选重新生成
          </button>
        </div>
      </div>
    </div>
  );
}

function DiffView({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="diff" style={{ maxHeight: '58vh' }}>
      {lines.map((d, i) => {
        if (d.kind === 'context') {
          return (
            <div key={i} className={`diff-row ${d.text === '…' ? 'hunk' : ''}`}>
              <span className="gutter">{d.oldLine > 0 ? d.oldLine : ''}{d.newLine > 0 ? ` ${d.newLine}` : ''}</span>
              <span className="sign">{d.text === '…' ? '⋯' : ' '}</span>
              <span className="text">{d.text}</span>
            </div>
          );
        }
        return (
          <div key={i} className={`diff-row ${d.kind}`}>
            <span className="gutter">{d.kind === 'del' ? d.oldLine : ''}{d.kind === 'add' ? ` ${d.newLine}` : ''}</span>
            <span className="sign">{d.kind === 'add' ? '+' : '-'}</span>
            <span className="text">{d.text}</span>
          </div>
        );
      })}
    </div>
  );
}
