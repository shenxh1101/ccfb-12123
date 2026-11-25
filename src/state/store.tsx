import type { ConfigKind, HostBundle, HostResult, RemediationFile, RuleDefinition, RuleFile } from '../engine/types';
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { ScanProgress } from '../engine/types';

export interface HostEntry {
  bundle: HostBundle;
  kinds: ConfigKind[];
  /** How the host entered the console, for the UI badge. */
  source: 'directory' | 'zip' | 'demo' | 'paste' | 'sample-suite';
}

export interface ScanState {
  running: boolean;
  done: number;
  total: number;
  host?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface AppState {
  rules: RuleDefinition[];
  ruleFile: RuleFile;
  hosts: HostEntry[];
  results: Record<string, HostResult>;
  order: string[];
  scan: ScanState;
  selectedHost: string | null;
  remediation: RemediationFile[];
  fixedResults: Record<string, HostResult>;
  fixedOrder: string[];
  fixedScanAt?: number;
  importInfo: {
    files: number;
    bytes: number;
    skipped: string[];
    warnings: string[];
    durationMs: number;
  } | null;
  notices: { id: number; tone: 'info' | 'warn' | 'error' | 'ok'; text: string }[];
}

const initial: AppState = {
  rules: [],
  ruleFile: { version: 1, name: '未加载', rules: [] },
  hosts: [],
  results: {},
  order: [],
  scan: { running: false, done: 0, total: 0 },
  selectedHost: null,
  remediation: [],
  fixedResults: {},
  fixedOrder: [],
  importInfo: null,
  notices: [],
};

type Action =
  | { type: 'setRules'; rules: RuleDefinition[]; file: RuleFile }
  | { type: 'addHosts'; hosts: HostEntry[]; info: AppState['importInfo'] }
  | { type: 'removeHost'; name: string }
  | { type: 'clearHosts' }
  | { type: 'scanStart'; total: number }
  | { type: 'scanProgress'; progress: ScanProgress }
  | { type: 'scanHostDone'; result: HostResult }
  | { type: 'scanDone'; durationMs: number }
  | { type: 'selectHost'; name: string | null }
  | { type: 'setRemediation'; files: RemediationFile[] }
  | { type: 'setFixed'; results: HostResult[]; order: string[]; at: number }
  | { type: 'clearFixed' }
  | { type: 'notice'; tone: AppState['notices'][number]['tone']; text: string }
  | { type: 'dismissNotice'; id: number };

let noticeId = 0;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setRules':
      return { ...state, rules: action.rules, ruleFile: action.file };
    case 'addHosts': {
      const byName = new Map(state.hosts.map((h) => [h.bundle.name, h]));
      for (const h of action.hosts) byName.set(h.bundle.name, h);
      return { ...state, hosts: [...byName.values()], importInfo: action.info };
    }
    case 'removeHost': {
      const { [action.name]: _drop, ...results } = state.results;
      return {
        ...state,
        hosts: state.hosts.filter((h) => h.bundle.name !== action.name),
        results,
        order: state.order.filter((n) => n !== action.name),
        selectedHost: state.selectedHost === action.name ? null : state.selectedHost,
      };
    }
    case 'clearHosts':
      return { ...state, hosts: [], results: {}, order: [], selectedHost: null, remediation: [], fixedResults: {}, fixedOrder: [] };
    case 'scanStart':
      return { ...state, results: {}, order: [], remediation: [], fixedResults: {}, fixedOrder: [], scan: { running: true, done: 0, total: action.total, startedAt: performance.now() } };
    case 'scanProgress':
      return {
        ...state,
        scan: { ...state.scan, done: action.progress.done, total: action.progress.total || state.scan.total, host: action.progress.host },
      };
    case 'scanHostDone': {
      const results = { ...state.results, [action.result.host]: action.result };
      return { ...state, results, order: [...state.order.filter((n) => n !== action.result.host), action.result.host] };
    }
    case 'scanDone':
      return { ...state, scan: { ...state.scan, running: false, finishedAt: performance.now() } };
    case 'selectHost':
      return { ...state, selectedHost: action.name };
    case 'setRemediation':
      return { ...state, remediation: action.files };
    case 'setFixed': {
      const results = { ...state.fixedResults };
      for (const r of action.results) results[r.host] = r;
      return { ...state, fixedResults: results, fixedOrder: action.order, fixedScanAt: action.at };
    }
    case 'clearFixed':
      return { ...state, fixedResults: {}, fixedOrder: [], fixedScanAt: undefined };
    case 'notice':
      return { ...state, notices: [...state.notices.slice(-4), { id: ++noticeId, tone: action.tone, text: action.text }] };
    case 'dismissNotice':
      return { ...state, notices: state.notices.filter((n) => n.id !== action.id) };
    default:
      return state;
  }
}

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  notify: (tone: AppState['notices'][number]['tone'], text: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, rules, ruleFile }: { children: ReactNode; rules: RuleDefinition[]; ruleFile: RuleFile }) {
  const [state, dispatch] = useReducer(reducer, { ...initial, rules, ruleFile });

  const notify = useCallback((tone: AppState['notices'][number]['tone'], text: string) => {
    dispatch({ type: 'notice', tone, text });
  }, []);

  const value = useMemo<StoreValue>(() => ({ state, dispatch, notify }), [state, notify]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用');
  return ctx;
}
