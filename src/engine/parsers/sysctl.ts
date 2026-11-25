import type { ConfigFileModel, ConfigNode, HostBundle, ParseIssue } from '../types';
import { basename, splitLines } from '../paths';

/** Ordered sysctl config locations, lowest precedence first (systemd-sysctl order). */
const SYSCTL_ROOTS = [
  '/usr/lib/sysctl.d',
  '/usr/local/lib/sysctl.d',
  '/run/sysctl.d',
  '/etc/sysctl.d',
  '/etc/sysctl.conf',
];

export function findSysctlFiles(bundle: HostBundle): string[] {
  const found: string[] = [];
  for (const root of SYSCTL_ROOTS) {
    if (bundle.files.has(root)) {
      found.push(root);
      continue;
    }
    const dir = root + '/';
    const children = bundle.order.filter((p) => p.startsWith(dir) && /\.conf$/.test(p) && !p.slice(dir.length).includes('/'));
    found.push(...children.sort());
  }
  // Any sysctl.conf-ish file outside standard dirs (e.g. /etc/sysctl.conf.local)
  for (const p of bundle.order) {
    if (!found.includes(p) && /(^|\/)sysctl\.conf$/.test(p)) found.push(p);
  }
  return found;
}

export function parseSysctl(bundle: HostBundle): ConfigFileModel {
  const files = findSysctlFiles(bundle);
  const root = files.includes('/etc/sysctl.conf') ? '/etc/sysctl.conf' : (files[files.length - 1] ?? '/etc/sysctl.conf');
  const issues: ParseIssue[] = [];
  const flat: ConfigNode[] = [];
  const nodes: ConfigNode[] = [];
  let idx = 0;

  for (const file of files) {
    const src = bundle.files.get(file);
    if (!src) continue;
    let section: string | null = null;
    const lines = splitLines(src.content);

    for (let i = 0; i < lines.length; i++) {
      let raw = lines[i];
      const trimmedRaw = raw.trim();
      if (!trimmedRaw) continue;
      // `;` and `#` start comments in sysctl.d; `-` prefix ignores write errors.
      let body = trimmedRaw;
      let ignoreError = false;
      if (body.startsWith('-')) {
        ignoreError = true;
        body = body.slice(1).trim();
      }
      if (body.startsWith('#') || body.startsWith(';')) continue;
      const commentIdx = body.search(/[#;]/);
      if (commentIdx >= 0) body = body.slice(0, commentIdx).trim();
      if (!body) continue;
      // section headers like `[section]` are not supported by sysctl but appear in stray files
      if (/^\[.*\]$/.test(body)) {
        section = body;
        continue;
      }
      const eq = body.indexOf('=');
      if (eq < 0) {
        issues.push({ file, line: i + 1, severity: 'warning', message: `无法识别的行（缺少 =）：${trimmedRaw}` });
        continue;
      }
      const key = body.slice(0, eq).trim();
      const value = body.slice(eq + 1).trim();
      if (!key) {
        issues.push({ file, line: i + 1, severity: 'warning', message: '键名为空' });
        continue;
      }
      const node: ConfigNode = {
        key,
        args: [value],
        raw: (ignoreError ? '-' : '') + `${key} = ${value}`,
        file,
        line: i + 1,
        via: [file],
        block: section ? [section] : [],
        index: idx++,
      };
      flat.push(node);
      nodes.push(node);
    }
  }

  return {
    kind: 'sysctl',
    root,
    files: [...new Set(files)],
    nodes,
    flat,
    includes: [],
    issues,
    stats: { statements: flat.length, files: new Set(files).size, bytes: files.reduce((a, f) => a + (bundle.files.get(f)?.size ?? 0), 0) },
    availableFiles: bundle.order,
    contents: Object.fromEntries(bundle.order.map((p) => [p, bundle.files.get(p)?.content ?? ''])),
  };
}

/** Later files / later lines win, except filenames prefixed with `-` in
 *  sysctl.d which never override an already-set key. */
export function sysctlEffective(model: ConfigFileModel): Map<string, ConfigNode> {
  const map = new Map<string, ConfigNode>();
  for (const node of model.flat) {
    const ignored = node.raw.startsWith('-') || basename(node.file).startsWith('-');
    if (ignored && map.has(node.key)) continue;
    map.set(node.key, node);
  }
  return map;
}

export function sysctlValue(node: ConfigNode | undefined): string | undefined {
  return node?.args[0];
}

export function sysctlAllValues(model: ConfigFileModel, key: string): ConfigNode[] {
  return model.flat.filter((n) => n.key === key);
}

export function numericSysctl(value: string | undefined): number | null {
  if (value === undefined) return null;
  const v = value.trim();
  if (/^-?\d+$/.test(v)) return Number.parseInt(v, 10);
  if (v === 'y' || v === 'yes') return 1;
  if (v === 'n' || v === 'no') return 0;
  return null;
}

