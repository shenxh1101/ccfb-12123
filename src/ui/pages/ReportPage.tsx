import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { AppPage } from '../../App';
import type { ScanReport } from '../../engine/types';
import { buildReport, reportToJson, reportToMarkdown, remediationToMarkdown, REPORT_SCHEMA_VERSION } from '../../engine/report';
import { buildRemediation } from '../../engine/remediation';
import { formatDuration } from '../../engine/paths';
import { Icon, EmptyState, ScoreRing } from '../components/primitives';

export function ReportPage({ go }: { go: (p: AppPage) => void }) {
  const { state, notify } = useStore();
  const [includeRemediation, setIncludeRemediation] = useState(false);
  const [tab, setTab] = useState<'markdown' | 'json'>('markdown');

  const hosts = useMemo(
    () => state.order.map((n) => state.results[n]).filter(Boolean),
    [state.order, state.results],
  );

  /** Patches come from the remediation page when it has run; otherwise they are
   *  rebuilt here so the report always has something to offer. */
  const remediations = useMemo(
    () =>
      state.remediation.length
        ? state.remediation
        : hosts.flatMap((h) => {
            const entry = state.hosts.find((x) => x.bundle.name === h.host);
            return entry ? buildRemediation(entry.bundle, h.results) : [];
          }),
    [state.remediation, hosts, state.hosts],
  );

  const report: ScanReport | null = useMemo(() => {
    if (!hosts.length) return null;
    const bytes = state.hosts.reduce((a, h) => a + h.bundle.meta.totalBytes, 0);
    const files = state.hosts.reduce((a, h) => a + h.bundle.meta.fileCount, 0);
    return buildReport({
      hosts,
      remediations,
      ruleSet: { name: state.ruleFile.name, version: state.ruleFile.version, count: state.rules.length },
      input: { hosts: hosts.length, files, bytes },
      durationMs:
        state.scan.startedAt && state.scan.finishedAt
          ? state.scan.finishedAt - state.scan.startedAt
          : hosts.reduce((a, h) => a + h.scanMs, 0),
    });
  }, [hosts, remediations, state.hosts, state.rules.length, state.ruleFile, state.scan.startedAt, state.scan.finishedAt]);

  const markdown = useMemo(() => {
    if (!report) return '';
    const base = reportToMarkdown(report);
    if (!includeRemediation || !remediations.length) return base;
    return `${base}\n${remediationToMarkdown(remediations)}\n`;
  }, [report, includeRemediation, remediations]);

  const json = useMemo(() => (report ? reportToJson(report) : ''), [report]);

  function download(kind: 'md' | 'json') {
    const text = kind === 'md' ? markdown : json;
    if (!text) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const blob = new Blob([text], { type: kind === 'md' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baseline-report-${stamp}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
    notify('ok', `已导出 ${kind.toUpperCase()} 报告`);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(tab === 'markdown' ? markdown : json);
      notify('ok', '报告已复制到剪贴板');
    } catch {
      notify('error', '剪贴板不可用，请使用下载按钮');
    }
  }

  if (!report) {
    return (
      <div className="card">
        <EmptyState icon="report" title="还没有可导出的报告" action={<button className="btn primary" onClick={() => go('scan')}><Icon name="scan" size={15} /> 去扫描</button>}>
          扫描完成后，这里会生成固定格式的 Markdown 与 JSON 报告。
        </EmptyState>
      </div>
    );
  }

  const t = report.totals;
  return (
    <div className="stack-lg">
      <div className="topbar">
        <div>
          <h1 className="page-title">报告导出</h1>
          <p className="page-sub">格式固定，可直接归档或接入工单系统 · schema v{REPORT_SCHEMA_VERSION}</p>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => void copy()}><Icon name="copy" size={15} /> 复制当前视图</button>
          <button className="btn" onClick={() => download('md')}><Icon name="download" size={15} /> 下载 Markdown</button>
          <button className="btn primary" onClick={() => download('json')}><Icon name="download" size={15} /> 下载 JSON</button>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="card card-pad row" style={{ gap: 14 }}>
          <ScoreRing score={t.score} size={62} />
          <div>
            <div className="faint tiny" style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>综合评分</div>
            <div style={{ fontSize: 19, fontWeight: 720 }}>{t.score}<span className="faint small"> / 100</span></div>
            <div className="faint tiny">{report.hosts.length} 台主机 · {report.input.files} 文件</div>
          </div>
        </div>
        <div className="stat bad"><div className="k">不通过</div><div className="v">{t.fail}</div><div className="sub">占 {t.total ? Math.round((t.fail / t.total) * 100) : 0}%</div></div>
        <div className="stat"><div className="k">通过</div><div className="v" style={{ color: 'var(--pass)' }}>{t.pass}</div><div className="sub">{t.warn} 项告警</div></div>
        <div className="stat"><div className="k">报告耗时</div><div className="v">{formatDuration(report.durationMs)}</div><div className="sub">生成于 {new Date(report.generatedAt).toLocaleString()}</div></div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="tabs">
            <button className={`tab ${tab === 'markdown' ? 'on' : ''}`} onClick={() => setTab('markdown')}>Markdown 预览</button>
            <button className={`tab ${tab === 'json' ? 'on' : ''}`} onClick={() => setTab('json')}>JSON 预览</button>
          </div>
          <div className="spacer" />
          <label className="pill-toggle">
            <input type="checkbox" checked={includeRemediation} onChange={(e) => setIncludeRemediation(e.target.checked)} />
            附带修复后配置差异
          </label>
          <span className="faint tiny">{tab === 'markdown' ? `${markdown.length.toLocaleString()} 字符` : `${json.length.toLocaleString()} 字符`}</span>
        </div>
        <div className="card-pad">
          <div className="report-preview" style={{ maxHeight: tab === 'markdown' ? '62vh' : '56vh' }}>
            {tab === 'markdown' ? markdown.slice(0, 60000) : json.slice(0, 60000)}
            {(tab === 'markdown' ? markdown.length : json.length) > 60000 ? '\n…（预览截断，下载可获取完整内容）' : ''}
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card card-pad stack">
          <div className="row"><Icon name="report" size={15} style={{ color: 'var(--accent)' }} /><b>Markdown 结构</b></div>
          <div className="small dim">
            固定章节：报告摘要 → 总体结论 → 主机汇总表 → 严重级别分布 → 每台主机的未通过项表、整改建议明细、已通过项、跳过项 → 检查项定义附录。
            可直接贴进 Wiki / 工单，表格列稳定，便于二次解析。
          </div>
        </div>
        <div className="card card-pad stack">
          <div className="row"><Icon name="code" size={15} style={{ color: 'var(--accent)' }} /><b>JSON 结构</b></div>
          <div className="small dim">
            顶层 schemaVersion / generatedAt / tool / ruleSet / input / durationMs / totals / hosts[]；
            每台主机含 summary、bySeverity、configs、parseIssues 与 results[]，结果内含 evidence（文件、行号、原始片段、include 链）与 remediation。
            字段只增不改，便于脚本消费。
          </div>
        </div>
      </div>
    </div>
  );
}
