import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { AppPage } from '../../App';
import { DEMO_HOSTS, makeBulkFleet } from '../../data/demo/hosts';
import JSZip from 'jszip';
import { groupImportedFiles, isZipFile, readFileList, readZipArchive, type ImportedFile, type ImportedHost } from '../../engine/import';
import { makeBundle } from '../../engine/fixtures';
import { formatBytes, formatDuration } from '../../engine/paths';
import type { ConfigKind, HostBundle } from '../../engine/types';
import { kindLabel } from '../../engine/scanner';
import { Icon, EmptyState } from '../components/primitives';
import type { HostEntry } from '../../state/store';

const KIND_TONE: Record<ConfigKind, string> = { sshd: 'sev-low', nginx: 'sev-high', sysctl: 'sev-medium' };

export function ImportPage({ go }: { go: (p: AppPage) => void }) {
  const { state, dispatch, notify } = useStore();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pasteName, setPasteName] = useState('');
  const [filter, setFilter] = useState('');

  const hosts = state.hosts;
  const totals = useMemo(
    () => ({
      files: hosts.reduce((a, h) => a + h.bundle.meta.fileCount, 0),
      bytes: hosts.reduce((a, h) => a + h.bundle.meta.totalBytes, 0),
    }),
    [hosts],
  );

  const addEntries = (
    entries: { name: string; files: { relativePath: string; content: string }[]; kinds: ConfigKind[]; origin: NonNullable<HostBundle['meta']['origin']> }[],
    info: { files: number; bytes: number; skipped: string[]; warnings: string[]; durationMs: number },
  ) => {
    if (!entries.length) {
      notify('warn', '没有识别到可用的配置文件（需包含 sshd_config / nginx.conf / sysctl.conf 等）');
      return;
    }
    const hostEntries: HostEntry[] = entries.map((e) => ({
      bundle: makeBundle(e.name, e.files, e.origin),
      kinds: e.kinds,
      source: e.origin,
    }));
    dispatch({ type: 'addHosts', hosts: hostEntries, info });
    notify('ok', `已导入 ${hostEntries.length} 台主机 / ${info.files} 个文件（${formatDuration(info.durationMs)}）`);
  };

  async function handleFiles(fileList: FileList | File[]) {
    setBusy(true);
    const started = performance.now();
    try {
      const all = [...fileList];
      const kinds = await Promise.all(all.map((f) => isZipFile(f)));
      const zips = all.filter((_, i) => kinds[i]);
      const plain = all.filter((_, i) => !kinds[i]);
      const files: ImportedFile[] = [];
      if (plain.length) files.push(...(await readFileList(plain)));
      for (const zip of zips) files.push(...(await readZipArchive(zip, zip.name)));
      const grouped = groupImportedFiles(files);
      const origin = zips.length ? ('zip' as const) : ('directory' as const);
      addEntries(
        grouped.hosts.map((h: ImportedHost) => ({ name: h.name, files: h.files, kinds: h.kinds, origin })),
        { files: grouped.files, bytes: grouped.bytes, skipped: grouped.skipped, warnings: grouped.warnings, durationMs: performance.now() - started },
      );
    } catch (err) {
      notify('error', `导入失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadDemo(bulk = 0) {
    setBusy(true);
    const started = performance.now();
    try {
      const list = bulk ? makeBulkFleet(bulk) : DEMO_HOSTS;
      const entries = list.map((d) => ({
        name: d.name,
        files: d.files,
        kinds: d.kinds,
        origin: 'demo' as const,
      }));
      addEntries(entries, {
        files: entries.reduce((a, e) => a + e.files.length, 0),
        bytes: entries.reduce((a, e) => a + e.files.reduce((x, y) => x + new Blob([y.content]).size, 0), 0),
        skipped: [],
        warnings: [],
        durationMs: performance.now() - started,
      });
    } finally {
      setBusy(false);
    }
  }

  async function downloadSampleZip(bulk = 0) {
    const zip = new JSZip();
    const list = bulk ? makeBulkFleet(bulk) : DEMO_HOSTS;
    for (const host of list) {
      for (const f of host.files) zip.file(`${host.name}${f.relativePath}`, f.content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = bulk ? 'baseline-fleet-120.zip' : 'baseline-fleet-demo.zip';
    a.click();
    URL.revokeObjectURL(url);
    notify('ok', `已导出 ${list.length} 台主机的样例配置包，可重新拖入导入验证`);
  }

  function addPasted() {
    if (!pasted.trim()) {
      notify('warn', '请先粘贴配置内容');
      return;
    }
    const name = pasteName.trim() || `pasted-${state.hosts.length + 1}`;
    const files = parsePastedConfig(pasted);
    if (!files.length) {
      notify('warn', '无法识别粘贴内容属于哪类配置（试试包含 Include/sshd_config 或 server { } 段落）');
      return;
    }
    addEntries(
      [{ name, files: files.map((f) => ({ relativePath: f.path, content: f.content })), kinds: detectKindsSimple(files), origin: 'paste' }],
      { files: files.length, bytes: files.reduce((a, f) => a + f.content.length, 0), skipped: [], warnings: [], durationMs: 0 },
    );
    setPasted('');
  }

  const filteredHosts = hosts.filter((h) => !filter || h.bundle.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="stack-lg">
      <div className="topbar">
        <div>
          <h1 className="page-title">配置导入</h1>
          <p className="page-sub">
            拖入一台或多台服务器的配置目录（或 .zip）· 全部在浏览器本地解析，不上传任何数据
          </p>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => void loadDemo()} disabled={busy}>
            <Icon name="sparkle" size={15} /> 载入演示主机
          </button>
          <button className="btn" onClick={() => void loadDemo(120)} disabled={busy}>
            <Icon name="layers" size={15} /> 生成 120 台压测数据
          </button>
          <button className="btn ghost" onClick={() => void downloadSampleZip()} disabled={busy} title="导出 zip 后可再次拖入，验证目录/压缩包导入">
            <Icon name="download" size={15} /> 导出样例配置包
          </button>
          {hosts.length ? (
            <button className="btn primary" onClick={() => go('scan')}>
              <Icon name="play" size={15} /> 开始扫描
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid cols-4">
        <div className="stat accent">
          <div className="k">已导入主机</div>
          <div className="v">{hosts.length}</div>
          <div className="sub">按 /etc 路径自动分组</div>
        </div>
        <div className="stat">
          <div className="k">配置文件</div>
          <div className="v">{totals.files}</div>
          <div className="sub">{formatBytes(totals.bytes)}</div>
        </div>
        <div className="stat">
          <div className="k">上次导入耗时</div>
          <div className="v">{state.importInfo ? formatDuration(state.importInfo.durationMs) : '—'}</div>
          <div className="sub">含读取、分组与路径归一</div>
        </div>
        <div className="stat">
          <div className="k">忽略文件</div>
          <div className="v">{state.importInfo?.skipped.length ?? 0}</div>
          <div className="sub">二进制 / 超大 / 非配置</div>
        </div>
      </div>

      <div className="card card-pad">
        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
          }}
        >
          <Icon name="upload" size={40} className="dz-icon" />
          <h3>拖入配置目录，或选择一批文件</h3>
          <p>
            支持整目录、批量多选或 <span className="mono">.zip</span> 压缩包；顶层目录名作为主机名，
            几百个文件在后台线程解析，界面不会卡顿。
          </p>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <label className="btn primary">
              <Icon name="folder" size={15} /> 选择目录
              <input
                type="file"
                // @ts-expect-error non-standard but supported in Chromium/WebKit
                webkitdirectory=""
                directory=""
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) void handleFiles(e.target.files);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <label className="btn">
              <Icon name="file" size={15} /> 选择文件 / ZIP
              <input
                type="file"
                multiple
                accept=".zip,application/zip"
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) void handleFiles(e.target.files);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <button className="btn ghost" onClick={() => go('rules')}>
              <Icon name="rules" size={15} /> 查看检查项
            </button>
          </div>
          {busy ? (
            <div style={{ marginTop: 14 }}>
              <div className="progress indeterminate"><i /></div>
              <div className="faint small" style={{ marginTop: 6 }}>正在读取并归一化路径…</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <Icon name="file" size={15} style={{ color: 'var(--accent)' }} />
            <h3 className="card-title">快速粘贴单段配置</h3>
            <div className="spacer" />
            <span className="card-hint">适合临时核对某台机器的一个文件</span>
          </div>
          <div className="card-pad stack">
            <div className="field">
              <label>主机名</label>
              <input className="input" value={pasteName} placeholder="例如 bastion-01" onChange={(e) => setPasteName(e.target.value)} />
            </div>
            <div className="field">
              <label>配置内容</label>
              <textarea
                className="textarea"
                rows={7}
                placeholder={'Port 22\nPermitRootLogin yes\n...'}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
            </div>
            <div className="row">
              <span className="faint small">会自动判断 SSH / Nginx / sysctl 类型并放到规范路径</span>
              <div className="spacer" />
              <button className="btn" onClick={addPasted}>加入主机列表</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <Icon name="info" size={15} style={{ color: 'var(--accent)' }} />
            <h3 className="card-title">导入规则说明</h3>
          </div>
          <div className="card-pad stack small dim">
            <div>• 目录结构按 <span className="mono">主机名/etc/ssh/sshd_config</span> 识别主机；多台机器的 <span className="mono">etc</span> 目录并列放入同一个顶层目录即可。</div>
            <div>• 只取配置与证书类文件（<span className="mono">.conf .cnf .cfg .ini .pem .crt .key …</span>），其它文件计入“忽略”。</div>
            <div>• 单文件上限 4 MB，超过会被跳过并提示，避免误拖镜像文件。</div>
            <div>• nginx 的 <span className="mono">include</span>、sshd 的 <span className="mono">Include</span> 与 <span className="mono">sysctl.d</span> 加载顺序会在解析时逐层展开。</div>
            <div>• 导入内容只保存在当前标签页内存中，刷新即清空。</div>
          </div>
        </div>
      </div>

      {state.importInfo && (state.importInfo.warnings.length > 0 || state.importInfo.skipped.length > 0) ? (
        <div className="banner warn">
          <Icon name="alert" size={18} className="bicon" />
          <div className="stack" style={{ gap: 6 }}>
            <div><b>导入提示</b>（{state.importInfo.skipped.length} 个文件未纳入）</div>
            {state.importInfo.warnings.slice(0, 6).map((w, i) => <div key={i} className="small">• {w}</div>)}
            {state.importInfo.skipped.length ? (
              <details>
                <summary className="small" style={{ cursor: 'pointer' }}>查看全部被忽略的文件</summary>
                <div className="small mono faint" style={{ marginTop: 6, maxHeight: 180, overflow: 'auto' }}>
                  {state.importInfo.skipped.map((s, i) => <div key={i}>{s}</div>)}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <Icon name="server" size={15} style={{ color: 'var(--accent)' }} />
          <h3 className="card-title">主机清单</h3>
          <span className="badge plain">{hosts.length}</span>
          <div className="spacer" />
          <div className="search" style={{ minWidth: 180 }}>
            <Icon name="search" />
            <input className="input" placeholder="筛选主机" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {hosts.length ? (
            <button className="btn sm danger" onClick={() => { dispatch({ type: 'clearHosts' }); notify('info', '已清空主机列表'); }}>
              <Icon name="trash" size={13} /> 清空
            </button>
          ) : null}
        </div>
        {hosts.length === 0 ? (
          <EmptyState icon="server" title="还没有导入任何主机" action={<button className="btn primary" onClick={() => void loadDemo()}><Icon name="sparkle" size={15} /> 载入演示主机开始体验</button>}>
            拖入一个包含 /etc 的目录，或点上方“载入演示主机”先体验完整流程。
          </EmptyState>
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>主机</th>
                  <th className="hide-sm">来源</th>
                  <th>配置类型</th>
                  <th className="num">文件</th>
                  <th className="num hide-sm">大小</th>
                  <th className="hide-sm">配置文件路径</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredHosts.map((h) => (
                  <tr key={h.bundle.name}>
                    <td style={{ whiteSpace: 'nowrap' }}><b>{h.bundle.name}</b></td>
                    <td className="hide-sm"><span className="badge plain">{sourceLabel(h.source)}</span></td>
                    <td>
                      <div className="chips">
                        {h.kinds.map((k) => (
                          <span key={k} className={`badge ${KIND_TONE[k]}`}>{kindLabel(k)}</span>
                        ))}
                        {h.kinds.length === 0 ? <span className="faint small">待识别</span> : null}
                      </div>
                    </td>
                    <td className="num">{h.bundle.meta.fileCount}</td>
                    <td className="num hide-sm">{formatBytes(h.bundle.meta.totalBytes)}</td>
                    <td className="hide-sm">
                      <span className="mono tiny faint" title={h.bundle.order.join('\n')}>
                        {primaryFiles(h.bundle.order).slice(0, 3).join('  ')}
                        {h.bundle.order.length > primaryFiles(h.bundle.order).slice(0, 3).length
                          ? `  … +${h.bundle.order.length - 3}`
                          : ''}
                      </span>
                    </td>
                    <td className="num">
                      <button className="btn xs ghost" onClick={() => { dispatch({ type: 'removeHost', name: h.bundle.name }); }} title="移除">
                        <Icon name="x" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Main config files first, so the preview names what the host actually runs. */
function primaryFiles(order: string[]): string[] {
  const rank = (p: string) =>
    /\/sshd_config$/.test(p) ? 0 : /\/nginx\.conf$/.test(p) ? 1 : /\/sysctl\.conf$/.test(p) ? 2 : /conf\.d\//.test(p) ? 3 : 4;
  return [...order].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function sourceLabel(s: HostEntry['source']): string {
  return { directory: '目录导入', zip: '压缩包', demo: '演示数据', paste: '粘贴', 'sample-suite': '样例' }[s] ?? s;
}

function detectKindsSimple(files: { path: string }[]): ConfigKind[] {
  const kinds = new Set<ConfigKind>();
  for (const f of files) {
    if (/sshd_config/.test(f.path)) kinds.add('sshd');
    else if (/nginx|\.conf$/.test(f.path) && !/sysctl/.test(f.path)) kinds.add('nginx');
    if (/sysctl/.test(f.path)) kinds.add('sysctl');
  }
  return [...kinds];
}

/** Guess the config kind from pasted content and return canonical paths. */
function parsePastedConfig(text: string): { path: string; content: string }[] {
  const sysctlHits = (text.match(/^\s*[a-z0-9_.]+\s*=/gm) ?? []).length;
  const sysctlKeys = (text.match(/^\s*(net|kernel|fs|vm|dev|sunrpc)\.[a-z0-9_.]+\s*=/gm) ?? []).length;
  const sshdHits = (text.match(/^\s*(PermitRootLogin|PasswordAuthentication|Port|Protocol|MaxAuthTries|ClientAliveInterval)\b/gm) ?? []).length;
  const nginxHits = (text.match(/^\s*(server|http|location|ssl_certificate|listen)\b.*[{;]/gm) ?? []).length + (text.includes('{') ? 1 : 0);
  if (sysctlKeys > 0 && sysctlKeys >= sshdHits) return [{ path: '/etc/sysctl.conf', content: text }];
  if (sshdHits > 0 && sshdHits >= nginxHits) return [{ path: '/etc/ssh/sshd_config', content: text }];
  if (nginxHits > 0) {
    return [{ path: /^\s*http\s*\{/m.test(text) ? '/etc/nginx/nginx.conf' : '/etc/nginx/conf.d/pasted.conf', content: text }];
  }
  if (sysctlHits > 0) return [{ path: '/etc/sysctl.conf', content: text }];
  return [];
}
