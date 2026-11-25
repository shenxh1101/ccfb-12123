import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { useScanRunner } from '../../state/useScanRunner';
import type { AppPage } from '../../App';
import type { ConfigKind, HostResult, RuleResult, Severity } from '../../engine/types';
import { SEVERITY_LABEL, SEVERITY_ORDER } from '../../engine/types';
import { kindLabel } from '../../engine/scanner';
import { formatDuration } from '../../engine/paths';
import { sortResults } from '../../engine/summary';
import { Icon, EmptyState, ProgressBar, ScoreRing } from '../components/primitives';
import { buildRemediation } from '../../engine/remediation';
import { ResultRow } from '../components/Evidence';

type StatusFilter = 'all' | 'fail' | 'warn' | 'pass' | 'skip';

export function ScanPage({ go }: { go: (p: AppPage) => void }) {
  const { state, dispatch, notify } = useStore();
  const [kinds, setKinds] = useState<ConfigKind[]>(['sshd', 'nginx', 'sysctl']);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('fail');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [query, setQuery] = useState('');
  const autoStarted = useRef(false);

  const runner = useScanRunner({
    onProgress: (done, total, host) => dispatch({ type: 'scanProgress', progress: { phase: 'rules', done, total, host } }),
    onHost: (result) => dispatch({ type: 'scanHostDone', result }),
    onDone: (durationMs) => {
      dispatch({ type: 'scanDone', durationMs });
      notify('ok', `扫描完成，用时 ${formatDuration(durationMs)}`);
    },
    onError: (message) => {
      dispatch({ type: 'scanDone', durationMs: 0 });
      notify('error', `扫描失败：${message}`);
    },
  });

  function startScan() {
    if (!state.hosts.length) {
      notify('warn', '请先在“配置导入”中添加主机');
      return;
    }
    dispatch({ type: 'scanStart', total: state.hosts.length });
    dispatch({ type: 'clearFixed' });
    runner.start(state.hosts, state.rules, kinds);
  }

  // Run once after importing hosts and landing on the scan page.
  useEffect(() => {
    if (!autoStarted.current && state.hosts.length && !state.order.length && !state.scan.running) {
      autoStarted.current = true;
      startScan();
    }
  }, [state.hosts.length, state.order.length, state.scan.running]);

  const results = useMemo(
    () => state.order.map((n) => state.results[n]).filter(Boolean) as HostResult[],
    [state.order, state.results],
  );
  const totals = useMemo(() => {
    const t = { total: 0, pass: 0, fail: 0, warn: 0, skip: 0, error: 0, critical: 0, high: 0, medium: 0, low: 0 };
    for (const h of results) {
      t.total += h.summary.total;
      t.pass += h.summary.pass;
      t.fail += h.summary.fail;
      t.warn += h.summary.warn;
      t.skip += h.summary.skip;
      t.error += h.summary.error;
      for (const sev of SEVERITY_ORDER) t[sev as 'critical'] += h.summary.bySeverity[sev].fail;
    }
    const scored = results.filter((h) => h.summary.total - h.summary.skip > 0);
    const score = scored.length ? scored.reduce((a, h) => a + h.summary.score, 0) / scored.length : 100;
    return { ...t, score: Math.round(score * 10) / 10, hosts: results.length };
  }, [results]);

  const findHost = (name: string) => state.hosts.find((h) => h.bundle.name === name);
  const fileContents = (hostName: string) => (file: string) => findHost(hostName)?.bundle.files.get(file)?.content;

  function prepareRemediation() {
    const files = results.flatMap((h) => {
      const entry = findHost(h.host);
      if (!entry) return [];
      return buildRemediation(entry.bundle, h.results);
    });
    dispatch({ type: 'setRemediation', files });
    go('remediation');
  }

  const statusMatches = (status: RuleResult['status']) =>
    statusFilter === 'all' ? true : statusFilter === 'fail' ? status === 'fail' || status === 'error' : status === statusFilter;

  const filterResults = (list: RuleResult[]) =>
    sortResults(list).filter((r) => {
      if (!statusMatches(r.status)) return false;
      if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          r.ruleId.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.message.toLowerCase().includes(q) ||
          r.evidence.some((e) => e.file.toLowerCase().includes(q) || e.snippet.toLowerCase().includes(q))
        );
      }
      return true;
    });

  const scanned = results.length > 0;

  return (
    <div className="stack-lg">
      <div className="topbar">
        <div>
          <h1 className="page-title">扫描结果</h1>
          <p className="page-sub">
            {scanned ? `${totals.hosts} 台主机 · ${totals.total} 项检查 · 按主机分组` : '导入配置后自动开始扫描'}
          </p>
        </div>
        <div className="topbar-actions">
          <div className="chips">
            {(['sshd', 'nginx', 'sysctl'] as ConfigKind[]).map((k) => (
              <button
                key={k}
                className={`chip ${kinds.includes(k) ? 'on' : ''}`}
                onClick={() => setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))}
                title={`${kindLabel(k)}检查项`}
              >
                {{ sshd: 'SSH', nginx: 'Nginx', sysctl: '内核参数' }[k]}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={startScan} disabled={state.scan.running || !state.hosts.length}>
            <Icon name="refresh" size={15} /> {state.scan.running ? '扫描中…' : scanned ? '重新扫描' : '开始扫描'}
          </button>
          {scanned ? (
            <button className="btn" onClick={prepareRemediation} disabled={!totals.fail && !totals.warn}>
              <Icon name="wrench" size={15} /> 生成整改方案
            </button>
          ) : null}
        </div>
      </div>

      {state.scan.running ? (
        <div className="card card-pad stack">
          <div className="row">
            <Icon name="scan" size={16} style={{ color: 'var(--accent)' }} />
            <b>正在扫描</b>
            <span className="dim small">{state.scan.host ?? '准备中…'}</span>
            <div className="spacer" />
            <span className="mono small">{state.scan.done} / {state.scan.total}</span>
          </div>
          <ProgressBar value={state.scan.done} total={state.scan.total} />
        </div>
      ) : null}

      {!scanned && !state.scan.running ? (
        <div className="card">
          <EmptyState
            icon="scan"
            title={state.hosts.length ? '尚无扫描结果' : '还没有可扫描的主机'}
            action={
              <div className="btn-group">
                <button className="btn primary" onClick={state.hosts.length ? startScan : () => go('import')}>
                  <Icon name={state.hosts.length ? 'play' : 'import'} size={15} />
                  {state.hosts.length ? '开始扫描' : '去导入配置'}
                </button>
              </div>
            }
          >
            {state.hosts.length
              ? `已导入 ${state.hosts.length} 台主机，点击开始扫描即可按规则集逐项检查。`
              : '先在“配置导入”页拖入 SSH、Nginx 与 sysctl 配置，再回来执行扫描。'}
          </EmptyState>
        </div>
      ) : null}

      {scanned ? (
        <>
          <div className="grid cols-4">
            <div className="card card-pad row" style={{ gap: 16 }}>
              <ScoreRing score={totals.score} size={68} />
              <div>
                <div className="faint tiny" style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>综合评分</div>
                <div style={{ fontSize: 20, fontWeight: 720 }}>{totals.score} <span className="faint small">/ 100</span></div>
                <div className="faint tiny">{totals.hosts} 台主机加权平均</div>
              </div>
            </div>
            <div className="stat bad">
              <div className="k">不通过</div>
              <div className="v">{totals.fail}</div>
              <div className="sub">严重 {totals.critical} · 高 {totals.high} · 中 {totals.medium} · 低 {totals.low}</div>
            </div>
            <div className="stat">
              <div className="k">通过</div>
              <div className="v" style={{ color: 'var(--pass)' }}>{totals.pass}</div>
              <div className="sub">占有效检查 {totals.pass + totals.fail + totals.warn ? Math.round((totals.pass / (totals.pass + totals.fail + totals.warn)) * 100) : 0}%</div>
            </div>
            <div className="stat warn">
              <div className="k">告警 / 跳过</div>
              <div className="v">{totals.warn}<span className="faint" style={{ fontSize: 14 }}> / {totals.skip}</span></div>
              <div className="sub">{state.scan.finishedAt && state.scan.startedAt ? `用时 ${formatDuration(state.scan.finishedAt - state.scan.startedAt)}` : '—'}</div>
            </div>
          </div>

          <div className="card">
            <div className="toolbar">
              <div className="search">
                <Icon name="search" />
                <input className="input" placeholder="搜索规则 / 主机 / 配置内容" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="tabs">
                {(['fail', 'warn', 'pass', 'skip', 'all'] as StatusFilter[]).map((s) => (
                  <button key={s} className={`tab ${statusFilter === s ? 'on' : ''}`} onClick={() => setStatusFilter(s)}>
                    {{ fail: '不通过', warn: '告警', pass: '通过', skip: '跳过', all: '全部' }[s]}
                  </button>
                ))}
              </div>
              <div className="spacer" />
              <select className="select" style={{ width: 130 }} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as Severity | 'all')}>
                <option value="all">全部级别</option>
                {SEVERITY_ORDER.map((s) => (
                  <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
                ))}
              </select>
              <div className="legend">
                {SEVERITY_ORDER.slice(0, 4).map((s) => (
                  <span key={s}><i style={{ background: `var(--${s})` }} />{SEVERITY_LABEL[s]}</span>
                ))}
              </div>
            </div>

            <div className="stack" style={{ padding: 14 }}>
              {results
                .slice()
                .sort((a, b) => a.summary.score - b.summary.score || a.host.localeCompare(b.host))
                .map((h) => {
                  const list = filterResults(h.results);
                  const open = expanded === h.host;
                  const hostEntry = findHost(h.host);
                  return (
                    <div className={`host-card ${open ? 'open' : ''}`} key={h.host}>
                      <div
                        className="host-head"
                        onClick={() => setExpanded(open ? null : h.host)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') setExpanded(open ? null : h.host); }}
                        aria-expanded={open}
                      >
                        <ScoreRing score={h.summary.score} size={54} />
                        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                          <div className="row" style={{ gap: 8 }}>
                            <Icon
                              name="chevron"
                              size={14}
                              style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .15s', color: 'var(--text-faint)' }}
                            />
                            <span className="host-name">{h.host}</span>
                            <span className="faint tiny">{hostEntry?.source === 'demo' ? '演示' : h.origin === 'directory' ? '目录导入' : h.origin ?? ''}</span>
                          </div>
                          <div className="host-meta">
                            {Object.entries(h.configs)
                              .filter(([, v]) => v)
                              .map(([k, v]) => (
                                <span key={k} className="badge plain mono">
                                  {kLabel(k as ConfigKind)} · {v!.files.length}f / {v!.statements} 指令
                                </span>
                              ))}
                            {h.issues.length ? <span className="badge st-warn"><i className="dot" />{h.issues.length} 解析提示</span> : null}
                          </div>
                        </div>
                        <div className="host-mini">
                          <div className="mini-stat"><b style={{ color: 'var(--critical)' }}>{h.summary.fail}</b><span>不通过</span></div>
                          <div className="mini-stat"><b style={{ color: 'var(--warn)' }}>{h.summary.warn}</b><span>告警</span></div>
                          <div className="mini-stat"><b style={{ color: 'var(--pass)' }}>{h.summary.pass}</b><span>通过</span></div>
                          <div className="mini-stat"><b className="faint">{h.summary.skip}</b><span>跳过</span></div>
                          <div style={{ width: 140 }}>
                            <div className="bar-stack" aria-hidden>
                              <i style={{ width: `${(h.summary.fail / Math.max(1, h.summary.total)) * 100}%`, background: 'var(--critical)' }} />
                              <i style={{ width: `${(h.summary.warn / Math.max(1, h.summary.total)) * 100}%`, background: 'var(--warn)' }} />
                              <i style={{ width: `${(h.summary.pass / Math.max(1, h.summary.total)) * 100}%`, background: 'var(--pass)' }} />
                              <i style={{ flex: 1, background: 'var(--skip)' }} />
                            </div>
                            <div className="faint tiny" style={{ marginTop: 4 }}>{h.summary.total} 项 · {formatDuration(h.scanMs)}</div>
                          </div>
                        </div>
                      </div>
                      {open ? (
                        <div className="host-body">
                          {list.length === 0 ? (
                            <div className="faint small" style={{ padding: '10px 2px' }}>
                              当前筛选条件下该主机没有结果。
                            </div>
                          ) : (
                            <div>
                              {list.slice(0, 80).map((r) => (
                                <ResultRow
                                  key={`${h.host}:${r.ruleId}`}
                                  result={r}
                                  fileContents={fileContents(h.host) ?? (() => undefined)}
                                  defaultOpen={list.length === 1}
                                  actions={
                                    <div className="rule-actions">
                                      <span className="badge plain mono">{kindLabel(ruleKind(r, state.rules))}</span>
                                      <button
                                        className="btn xs ghost"
                                        onClick={() => {
                                          // The shell's hashchange listener performs navigation.
                                          window.location.hash = `#/rules?rule=${encodeURIComponent(r.ruleId)}`;
                                        }}
                                      >
                                        <Icon name="rules" size={11} /> 查看规则定义
                                      </button>
                                    </div>
                                  }
                                />
                              ))}
                              {list.length > 80 ? <div className="faint small">仅显示前 80 项，请使用筛选缩小范围（共 {list.length} 项）</div> : null}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function kLabel(k: ConfigKind): string {
  return { sshd: 'SSH', nginx: 'Nginx', sysctl: '内核' }[k];
}

function ruleKind(r: RuleResult, rules: { id: string; kind: ConfigKind }[]): ConfigKind {
  return rules.find((x) => x.id === r.ruleId)?.kind ?? 'sshd';
}
