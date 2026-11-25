/** Core data model shared by parsers, rule engine and UI. */

export type ConfigKind = 'sshd' | 'nginx' | 'sysctl';

export interface SourceFile {
  /** Virtual absolute path inside a host bundle, e.g. `/etc/nginx/nginx.conf`. */
  path: string;
  content: string;
  size: number;
}

export interface HostBundle {
  name: string;
  /** Files keyed by normalised virtual path. */
  files: Map<string, SourceFile>;
  /** Every file path, sorted for deterministic output. */
  order: string[];
  meta: HostMeta;
}

export interface HostMeta {
  importedAt?: string;
  origin?: 'directory' | 'zip' | 'demo' | 'paste' | 'sample-suite';
  fileCount: number;
  totalBytes: number;
}

export interface InputFile {
  /** Upload-relative path, e.g. `web-01/etc/nginx/nginx.conf`. */
  relativePath: string;
  content: string;
  size?: number;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
  info: '提示',
};

/** A single parsed configuration statement with full provenance. */
export interface ConfigNode {
  /** Directive / key name. nginx `server`, sshd `PermitRootLogin`, sysctl `net.ipv4.ip_forward`. */
  key: string;
  args: string[];
  /** Raw single-line text of the statement (without leading indentation). */
  raw: string;
  /** Virtual path of the file the statement came from. */
  file: string;
  line: number;
  column?: number;
  /** Include chain from the root file down to this statement's file, root first. */
  via: string[];
  /** Nesting block path, e.g. `http > server > location`. */
  block: string[];
  /** Present for nginx-style block statements. */
  children?: ConfigNode[];
  /** 0-based index of the statement within its file, used for ordering. */
  index: number;
  /** True when this node came from an include expansion (rather than literal text). */
  fromInclude?: boolean;
  /** For nginx `map`/`upstream` style section markers we keep the body. */
  endLine?: number;
}

export interface ConfigFileModel {
  kind: ConfigKind;
  /** Root file (main config) for this kind. */
  root: string;
  /** All files actually parsed, in expansion order. */
  files: string[];
  /** Top-level statements, includes expanded in place. */
  nodes: ConfigNode[];
  /** Flat list of every statement in document order (including block children). */
  flat: ConfigNode[];
  /** Include graph edges: from -> to, used for the include tree view. */
  includes: IncludeEdge[];
  issues: ParseIssue[];
  stats: { statements: number; files: number; bytes: number };
  /** Every file path available in the host bundle (for existence checks). */
  availableFiles: string[];
  /** Raw text of every file in the bundle, for remediation rendering. */
  contents: Record<string, string>;
}

export interface IncludeEdge {
  from: string;
  to: string;
  line: number;
  raw: string;
  glob: string;
  matched: string[];
  cycle?: boolean;
  missing?: boolean;
}

export interface ParseIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface HostInventory {
  host: HostBundle;
  configs: Partial<Record<ConfigKind, ConfigFileModel>>;
  issues: ParseIssue[];
}

export type RuleStatus = 'pass' | 'fail' | 'warn' | 'skip' | 'error';

export interface RuleResult {
  ruleId: string;
  title: string;
  category: string;
  severity: Severity;
  status: RuleStatus;
  /** Human-readable explanation of why the rule passed/failed. */
  message: string;
  /** Concrete evidence tied to source lines. */
  evidence: Evidence[];
  /** Observed value summary for the report table. */
  observed?: string;
  expected?: string;
  remediation?: string;
  /** Fix plan used by the remediation generator (populated when fail/warn). */
  fix?: FixPlan;
  durationMs: number;
}

export interface Evidence {
  file: string;
  line: number;
  column?: number;
  /** Raw config text of the triggering line, trimmed. */
  snippet: string;
  via?: string[];
  block?: string[];
  note?: string;
}

export type FixOpKind = 'replace' | 'delete' | 'insertBefore' | 'insertAfter';

export interface FixOp {
  kind: FixOpKind;
  file: string;
  /** 1-based anchor line: the line to replace/delete, or the line to insert next to. */
  line: number;
  /** Statement text without indentation (ignored for delete). */
  text?: string;
  /** Indentation used for inserted lines. */
  indent?: string;
  reason: string;
  ruleId?: string;
}

export interface FixPlan {
  ops: FixOp[];
  /** Files that must be created because no existing file can host the directive. */
  createFiles?: { file: string; content: string; ruleIds: string[] }[];
  summary: string;
}

export interface SamplePatch {
  /** Virtual path inside the sample bundle. */
  file: string;
  /** Exact text to locate (may span lines). */
  find?: string;
  /** Replacement text; omit to delete the matched text. */
  replace?: string;
  /** Append text to the end of the file. */
  append?: string;
  /** Assert the file is absent after patching. */
  removeFile?: boolean;
  /** 1-based occurrence to replace; default 1. */
  occurrence?: number;
}

export interface RuleSamples {
  pass: SamplePatch[];
  fail: SamplePatch[];
  /** Notes shown in the UI describing what the samples demonstrate. */
  passNote?: string;
  failNote?: string;
}

export interface RuleDefinition {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  /** Which config kind the rule reads. */
  kind: ConfigKind;
  description: string;
  remediation: string;
  /** Reference id such as CIS / 等保 clause. */
  reference?: string;
  /** Declarative matcher. */
  check: RuleCheck;
  /** Optional declaration of a compliant value used by the fix generator. */
  fix?: RuleFixSpec;
  /** Each rule ships one compliant and one non-compliant fixture diff. */
  samples?: RuleSamples;
  /** Whether `warn` should be used instead of `fail` for certain conditions. */
  tags?: string[];
}

export type CompareOp = '>=' | '<=' | '>' | '<' | '==' | '!=';

export type RuleCheck =
  /** sshd: effective (first-wins) global value. */
  | { type: 'sshdValue'; key: string; equals?: string; in?: string[]; matches?: string; caseInsensitive?: boolean; absentMeans?: 'pass' | 'fail' }
  | { type: 'sshdAbsent'; key: string; note?: string }
  | { type: 'sshdPresent'; key: string; note?: string }
  | { type: 'sshdNumeric'; key: string; op: CompareOp; value: number; absentMeans?: 'pass' | 'fail' }
  | { type: 'sshdListSubset'; key: string; allowed: string[]; require?: string[]; absentMeans?: 'pass' | 'fail' }
  | { type: 'sshdListExcludes'; key: string; forbidden: string[]; absentMeans?: 'pass' | 'fail' }
  /** sysctl: effective (last-wins) value. */
  | { type: 'sysctlEquals'; key: string; value: string | number; absentMeans?: 'pass' | 'fail' }
  | { type: 'sysctlNumeric'; key: string; op: CompareOp; value: number; absentMeans?: 'pass' | 'fail' }
  | { type: 'sysctlOneOf'; key: string; values: (string | number)[]; absentMeans?: 'pass' | 'fail' }
  /** nginx: directive resolved with inheritance for every server block. */
  | { type: 'nginxServerValue'; key: string; scope?: 'all' | 'ssl'; equals?: string; in?: string[]; subsetOf?: string[]; matches?: string; absentMeans?: 'pass' | 'fail' }
  | { type: 'nginxServerHeader'; name: string; valueMatches?: string; scope?: 'all' | 'ssl' }
  | { type: 'nginxServerCipher'; key: string; forbidden: string[]; require?: string[]; scope?: 'all' | 'ssl' }
  | { type: 'nginxServerFile'; key: string; scope?: 'all' | 'ssl' }
  | { type: 'nginxHttpValue'; key: string; equals?: string; in?: string[]; absentMeans?: 'pass' | 'fail'; present?: boolean }
  | { type: 'nginxLocationValue'; key: string; equals?: string; absentMeans?: 'pass' | 'fail' }
  | { type: 'nginxOrphanIncludes'; dir: string }
  | { type: 'allOf'; checks: RuleCheck[] }
  | { type: 'anyOf'; checks: RuleCheck[] }
  | { type: 'not'; check: RuleCheck };

export interface RuleFixSpec {
  /** Default target file; evaluators may override with a more precise target. */
  file?: string;
  key?: string;
  args?: string[];
  mode: 'set' | 'append';
}

export interface RuleFile {
  version: number;
  name: string;
  description?: string;
  rules: RuleDefinition[];
}

export interface ScanProgress {
  phase: 'inventory' | 'parse' | 'rules' | 'done';
  host?: string;
  done: number;
  total: number;
  message?: string;
}

export interface HostResult {
  host: string;
  origin?: HostMeta['origin'];
  results: RuleResult[];
  summary: ScanSummary;
  configs: Partial<Record<ConfigKind, { root: string; files: string[]; statements: number; issues: number }>>;
  issues: ParseIssue[];
  scanMs: number;
}

export interface ScanSummary {
  total: number;
  pass: number;
  fail: number;
  warn: number;
  skip: number;
  error: number;
  score: number;
  bySeverity: Record<Severity, { pass: number; fail: number; warn: number; skip: number; error: number }>;
}

export interface ScanReport {
  generatedAt: string;
  tool: { name: string; version: string };
  ruleSet: { name: string; version: number; count: number };
  hosts: HostResult[];
  totals: ScanSummary;
  input: { hosts: number; files: number; bytes: number };
  durationMs: number;
}

export interface RemediationFile {
  host: string;
  file: string;
  original: string;
  patched: string;
  diff: DiffLine[];
  ops: FixOp[];
  ruleIds: string[];
}

export type DiffLine =
  | { kind: 'context'; text: string; oldLine: number; newLine: number }
  | { kind: 'add'; text: string; newLine: number }
  | { kind: 'del'; text: string; oldLine: number };
