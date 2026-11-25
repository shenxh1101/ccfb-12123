import { useEffect, useMemo, useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { ImportPage } from './ui/pages/ImportPage';
import { RulesPage } from './ui/pages/RulesPage';
import { ScanPage } from './ui/pages/ScanPage';
import { RemediationPage } from './ui/pages/RemediationPage';
import { ReportPage } from './ui/pages/ReportPage';
import { ConfigPage } from './ui/pages/ConfigPage';
import { Icon } from './ui/components/primitives';
import rulesJson from './data/rules/baseline-rules.json';
import { validateRuleFile } from './engine/scanner';
import type { RuleFile } from './engine/types';

export type AppPage = 'import' | 'rules' | 'scan' | 'config' | 'remediation' | 'report';

const PAGES: { id: AppPage; label: string; short: string; icon: 'import' | 'rules' | 'scan' | 'code' | 'wrench' | 'report' }[] = [
  { id: 'import', label: '配置导入', short: '导入', icon: 'import' },
  { id: 'rules', label: '检查项', short: '检查项', icon: 'rules' },
  { id: 'scan', label: '扫描结果', short: '结果', icon: 'scan' },
  { id: 'config', label: '配置视图', short: '配置', icon: 'code' },
  { id: 'remediation', label: '整改建议', short: '整改', icon: 'wrench' },
  { id: 'report', label: '报告导出', short: '报告', icon: 'report' },
];

export function App() {
  const parsed = useMemo(() => {
    const file = rulesJson as unknown as RuleFile;
    const { rules } = validateRuleFile(file);
    return { rules, file };
  }, []);
  return (
    <StoreProvider rules={parsed.rules} ruleFile={parsed.file}>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const [page, setPage] = useState<AppPage>(() => (hashPage() ?? 'import'));
  const { state, dispatch } = useStore();

  // Notices are transient: fade out on their own so they never hide the diff.
  useEffect(() => {
    if (!state.notices.length) return;
    const timers = state.notices.map((n) => setTimeout(() => dispatch({ type: 'dismissNotice', id: n.id }), 5200));
    return () => timers.forEach(clearTimeout);
  }, [state.notices, dispatch]);

  useEffect(() => {
    const onHash = () => setPage(hashPage() ?? 'import');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (p: AppPage) => {
    setPage(p);
    window.location.hash = `#/${p}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const counts = useMemo(() => {
    const fails = Object.values(state.results).reduce((a, r) => a + r.summary.fail + r.summary.warn, 0);
    return {
      import: state.hosts.length,
      rules: state.rules.length,
      scan: state.order.length ? fails : 0,
      remediation: state.remediation.length,
      report: 0,
      config: state.hosts.length,
    } as Record<AppPage, number>;
  }, [state.hosts.length, state.rules.length, state.order.length, state.results, state.remediation.length]);

  return (
    <div className="app">
      <nav className="sidebar" aria-label="主导航">
        <div className="brand">
          <div className="brand-mark">BL</div>
          <div className="brand-text">
            <div className="brand-name">基线检查台</div>
            <div className="brand-sub">CONFIG BASELINE CONSOLE</div>
          </div>
        </div>
        <div className="nav-label">工作流</div>
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={`nav-item ${page === p.id ? 'active' : ''}`}
            onClick={() => go(p.id)}
            aria-current={page === p.id ? 'page' : undefined}
          >
            <Icon name={p.icon} size={17} className="nav-icon" />
            <span className="nav-label-inline">{p.short}</span>
            <span className="nav-text">{p.label}</span>
            {counts[p.id] ? <span className="nav-count">{counts[p.id]}</span> : null}
          </button>
        ))}
        <div className="sidebar-foot">
          <div><b>本地解析</b> · 不上传配置</div>
          <div style={{ marginTop: 4 }}>规则 v{state.ruleFile.version} · {state.rules.length} 条</div>
          <div style={{ marginTop: 4 }}>SSH · Nginx · sysctl</div>
        </div>
      </nav>
      <main className="main">
        {page === 'import' ? <ImportPage go={go} /> : null}
        {page === 'rules' ? <RulesPage go={go} /> : null}
        {page === 'scan' ? <ScanPage go={go} /> : null}
        {page === 'config' ? <ConfigPage go={go} /> : null}
        {page === 'remediation' ? <RemediationPage go={go} /> : null}
        {page === 'report' ? <ReportPage go={go} /> : null}
      </main>
      <div className="notices" aria-live="polite">
        {state.notices.map((n) => (
          <div key={n.id} className={`notice ${n.tone}`}>
            <div className="bar" />
            <div>{n.text}</div>
            <button onClick={() => dispatch({ type: 'dismissNotice', id: n.id })} aria-label="关闭提示">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function hashPage(): AppPage | null {
  // Deep links look like `#/rules?rule=SSH-001`; only the path names the page.
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  if (!hash) return null;
  return PAGES.some((p) => p.id === hash) ? (hash as AppPage) : null;
}
