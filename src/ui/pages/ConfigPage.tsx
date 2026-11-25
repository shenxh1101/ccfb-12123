import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { AppPage } from '../../App';
import type { ConfigKind, ConfigNode, HostBundle } from '../../engine/types';
import { parseAll } from '../../engine/scanner';
import { Icon, EmptyState } from '../components/primitives';
import { CodeView } from '../components/Evidence';

/** Read-only browser for parsed configs, include graph and the statement tree. */
export function ConfigPage({ go }: { go: (p: AppPage) => void }) {
  const { state } = useStore();
  const [hostName, setHostName] = useState<string>(state.hosts[0]?.bundle.name ?? '');
  const [kind, setKind] = useState<ConfigKind>('nginx');
  const [file, setFile] = useState<string | null>(null);
  const [view, setView] = useState<'source' | 'tree' | 'includes'>('source');

  const host: HostBundle | undefined = state.hosts.find((h) => h.bundle.name === hostName)?.bundle;
  const availableKinds = useMemo(() => {
    if (!host) return [] as ConfigKind[];
    const models = parseAll(host, ['sshd', 'nginx', 'sysctl']);
    return (Object.keys(models) as ConfigKind[]).filter((k) => (models[k]?.files.length ?? 0) > 0 || (models[k]?.flat.length ?? 0) > 0);
  }, [host]);

  const activeKind = availableKinds.includes(kind) ? kind : availableKinds[0] ?? kind;
  const model = useMemo(() => (host ? parseAll(host, [activeKind])[activeKind] : undefined), [host, activeKind]);
  const activeFile = file && model?.files.includes(file) ? file : model?.files[0] ?? null;
  const content = activeFile ? host?.files.get(activeFile)?.content ?? '' : '';

  if (!state.hosts.length) {
    return (
      <div className="card">
        <EmptyState icon="code" title="还没有配置可查看" action={<button className="btn primary" onClick={() => go('import')}><Icon name="import" size={15} /> 去导入配置</button>}>
          导入主机后，这里可以查看展开 include 之后的指令树、include 引用关系和原始文件。
        </EmptyState>
      </div>
    );
  }

  const evidenceLines = new Map<number, 'fail' | 'pass' | 'warn'>();
  const hostResult = state.results[hostName];
  if (hostResult) {
    for (const r of hostResult.results) {
      for (const e of r.evidence) {
        if (e.file === activeFile) evidenceLines.set(e.line, r.status === 'pass' ? 'pass' : 'fail');
      }
    }
  }

  return (
    <div className="stack-lg">
      <div className="topbar">
        <div>
          <h1 className="page-title">配置视图</h1>
          <p className="page-sub">展开 include / 多级引用后的生效配置，与扫描命中的行一一对应</p>
        </div>
        <div className="topbar-actions">
          <select className="select" style={{ width: 170 }} value={hostName} onChange={(e) => { setHostName(e.target.value); setFile(null); }}>
            {state.hosts.map((h) => <option key={h.bundle.name} value={h.bundle.name}>{h.bundle.name}</option>)}
          </select>
          <div className="tabs">
            {availableKinds.map((k) => (
              <button key={k} className={`tab ${activeKind === k ? 'on' : ''}`} onClick={() => { setKind(k); setFile(null); }}>
                {{ sshd: 'SSH', nginx: 'Nginx', sysctl: '内核' }[k]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!model ? (
        <div className="card"><EmptyState icon="file" title="该主机没有可用配置" /></div>
      ) : (
        <>
          <div className="grid cols-4">
            <div className="stat"><div className="k">解析文件</div><div className="v">{model.files.length}</div><div className="sub">含 include 展开文件</div></div>
            <div className="stat"><div className="k">指令条数</div><div className="v">{model.stats.statements}</div><div className="sub">含块内子指令</div></div>
            <div className="stat"><div className="k">include 指令</div><div className="v">{model.includes.length}</div><div className="sub">{model.includes.filter((i) => i.missing).length} 条未匹配</div></div>
            <div className="stat"><div className="k">解析提示</div><div className="v">{model.issues.length}</div><div className="sub">语法 / 缺失文件</div></div>
          </div>

          <div className="card">
            <div className="toolbar">
              <span className="mono small dim">{model.root}</span>
              <div className="spacer" />
              <div className="tabs">
                <button className={`tab ${view === 'source' ? 'on' : ''}`} onClick={() => setView('source')}>源文件</button>
                <button className={`tab ${view === 'tree' ? 'on' : ''}`} onClick={() => setView('tree')}>指令树</button>
                <button className={`tab ${view === 'includes' ? 'on' : ''}`} onClick={() => setView('includes')}>include 关系</button>
              </div>
            </div>

            {view === 'source' ? (
              <div className="split" style={{ padding: 14 }}>
                <div>
                  <CodeView content={content} highlights={evidenceLines} />
                  <div className="legend" style={{ marginTop: 8 }}>
                    <span><i style={{ background: 'var(--critical)' }} />扫描命中行</span>
                    <span><i style={{ background: 'var(--pass)' }} />通过项命中行</span>
                    <span className="faint">共用行号与“扫描结果”页一致</span>
                  </div>
                </div>
                <div className="card">
                  <div className="card-head"><Icon name="file" size={14} /><h3 className="card-title">文件列表</h3><span className="badge plain">{model.files.length}</span></div>
                  <div className="filetab-list">
                    {model.files.map((f) => {
                      const node = model.includes.find((i) => i.matched.includes(f));
                      return (
                        <button key={f} className={`filetab ${f === activeFile ? 'on' : ''}`} onClick={() => setFile(f)} title={f}>
                          <Icon name="file" size={12} />{f}
                          {node ? <span className="badge plain tiny" style={{ marginLeft: 'auto' }}>include</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {view === 'tree' ? (
              <div className="card-pad">
                <div className="faint small" style={{ marginBottom: 8 }}>
                  按 nginx / sshd 的层级展开，每行末尾是原始文件与行号；带 <span className="badge plain mono">↳ include</span> 标记的条目来自 include 展开。
                </div>
                <div className="tree tree-rows" style={{ maxHeight: '66vh' }}>
                  {flattenTree(model.nodes, 0).map((row, i) => (
                    <div key={i} className={`tree-row ${row.close ? 'close' : ''} ${row.node.fromInclude ? 'inc' : ''}`}>
                      <span className="t-indent" style={{ width: row.depth * 18 }} />
                      {row.close ? (
                        <span className="t-body">{'}'}</span>
                      ) : (
                        <>
                          <span className="t-body">
                            <span className="t-key">{row.node.key}</span>
                            {row.node.args.length ? <span className="t-arg"> {row.node.args.join(' ')}</span> : null}
                            {row.node.children ? <span className="t-punct">{' {'}</span> : null}
                          </span>
                          <span className="t-loc" title={`${row.node.file}:${row.node.line}`}>
                            {shortFile(row.node.file)}:{row.node.line}
                            {row.node.fromInclude ? <span className="t-badge">include</span> : null}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {view === 'includes' ? (
              <div className="card-pad">
                {model.includes.length === 0 ? (
                  <div className="faint small">该配置没有 include 指令（sysctl 采用目录加载顺序，见下方说明）。</div>
                ) : (
                  <div className="table-wrap">
                    <table className="table compact">
                      <thead>
                        <tr><th>来源文件</th><th>行号</th><th>include 表达式</th><th>展开结果</th><th>状态</th></tr>
                      </thead>
                      <tbody>
                        {model.includes.map((inc, i) => (
                          <tr key={i}>
                            <td className="mono tiny">{inc.from}</td>
                            <td className="mono tiny">{inc.line || '—'}</td>
                            <td className="mono tiny">{inc.glob}</td>
                            <td className="mono tiny">{inc.matched.length ? inc.matched.join(', ') : '—'}</td>
                            <td>
                              {inc.cycle ? <span className="badge st-error">循环引用</span> : inc.missing ? <span className="badge st-warn">未匹配</span> : <span className="badge st-pass">已展开</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {activeKind === 'sysctl' ? (
                  <div className="banner" style={{ marginTop: 12 }}>
                    <Icon name="info" size={18} className="bicon" />
                    <div>
                      sysctl 的加载顺序为 <span className="mono">/usr/lib → /usr/local/lib → /run → /etc/sysctl.d → /etc/sysctl.conf</span>，
                      同名键后加载者生效。导入的文件按此顺序解析，冲突的重复设置会在扫描结果里给出提示。
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {model.issues.length ? (
              <div className="card-pad" style={{ borderTop: '1px solid var(--line-soft)' }}>
                <div className="faint tiny" style={{ marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>解析提示</div>
                <div className="stack" style={{ gap: 4 }}>
                  {model.issues.map((i, idx) => (
                    <div key={idx} className="small dim mono">{i.file}:{i.line} · {i.message}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

interface TreeRow {
  depth: number;
  node: ConfigNode;
  close?: boolean;
}

function flattenTree(nodes: ConfigNode[], depth: number): TreeRow[] {
  const rows: TreeRow[] = [];
  for (const node of nodes) {
    rows.push({ depth, node });
    if (node.children?.length) {
      rows.push(...flattenTree(node.children, depth + 1));
      rows.push({ depth, node, close: true });
    }
  }
  return rows;
}

function shortFile(path: string): string {
  const parts = path.split('/');
  // `conf.d/shop.conf` instead of `/etc/nginx/conf.d/shop.conf` keeps lines short.
  return parts.slice(-2).join('/');
}
