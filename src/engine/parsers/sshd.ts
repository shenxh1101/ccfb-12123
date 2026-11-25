import type { ConfigFileModel, ConfigNode, HostBundle, IncludeEdge, ParseIssue } from '../types';
import { basename, dirname, splitLines, stripComment } from '../paths';
import { globMatch } from '../glob';

export function findSshdRoots(bundle: HostBundle): string[] {
  return bundle.order.filter(
    (p) =>
      /(^|\/)sshd_config$/.test(p) ||
      /(^|\/)sshd_config\.d\/[^/]+\.conf$/.test(p) ||
      /(^|\/)ssh\/sshd_config$/.test(p),
  );
}

interface SshdStatement {
  key: string;
  args: string[];
  line: number;
  raw: string;
  match?: string[] | null;
}

function tokenizeSshd(content: string, file: string, issues: ParseIssue[]): SshdStatement[] {
  const lines = splitLines(content);
  const out: SshdStatement[] = [];
  let inMatch: string[] | null = null;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const noComment = stripComment(rawLine, ['#']);
    const trimmed = noComment.trim();
    if (!trimmed) continue;
    const parts = splitArgsLoose(trimmed);
    if (!parts.length) continue;
    const key = parts[0];
    const lower = key.toLowerCase();
    if (lower === 'match') {
      const args = parts.slice(1);
      inMatch = args.length ? args : null;
      out.push({ key: 'Match', args, line: i + 1, raw: trimmed, match: null });
      continue;
    }
    if (lower === 'include') {
      out.push({ key: 'Include', args: parts.slice(1), line: i + 1, raw: trimmed, match: inMatch });
      continue;
    }
    if (lower === 'hostkey' || lower === 'hostcertificate') {
      // allowed, keep as-is
    }
    if (parts.length === 1) {
      issues.push({ file, line: i + 1, severity: 'warning', message: `指令 ${key} 缺少参数` });
    }
    out.push({ key, args: parts.slice(1), line: i + 1, raw: trimmed, match: inMatch ? [...inMatch] : null });
  }
  return out;
}

/** sshd_config allows `Key=Value` syntax (OpenSSH 7.0+). Split loosely but keep quotes. */
function splitArgsLoose(input: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch) || (ch === '=' && cur && out.length === 0)) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export function parseSshd(bundle: HostBundle): ConfigFileModel {
  const roots = findSshdRoots(bundle);
  const root = roots.find((p) => basename(p) === 'sshd_config') ?? roots[0] ?? '/etc/ssh/sshd_config';
  const issues: ParseIssue[] = [];
  const includes: IncludeEdge[] = [];
  const files: string[] = [];
  const flat: ConfigNode[] = [];
  const nodes: ConfigNode[] = [];
  const stack: string[] = [];
  let idx = 0;

  const expand = (path: string, via: string[], matchScope: string[] | null): ConfigNode[] => {
    const file = bundle.files.get(path);
    if (!file) return [];
    if (stack.includes(path)) {
      includes.push({ from: via[via.length - 1] ?? path, to: path, line: 0, raw: 'Include', glob: path, matched: [], cycle: true });
      issues.push({ file: path, line: 0, severity: 'error', message: `Include 循环引用：${[...via, path].join(' → ')}` });
      return [];
    }
    stack.push(path);
    files.push(path);
    const stmts = tokenizeSshd(file.content, path, issues);
    const lines = splitLines(file.content);
    const local: ConfigNode[] = [];

    // Include files are evaluated in place; `Match` state carries across includes
    // in real sshd, so track the current match scope for this file and return it.
    let currentMatch: string[] | null = matchScope;

    for (const st of stmts) {
      if (st.key === 'Include') {
        for (const arg of st.args) {
          // sshd resolves relative globs against /etc/ssh
          const pattern = arg.startsWith('/') ? arg : `/etc/ssh/${arg}`;
          const fallback = arg.startsWith('/') ? arg : `${dirname(path)}/${arg}`;
          let matched = globMatch(pattern, bundle.order);
          if (!matched.length) matched = globMatch(fallback, bundle.order);
          includes.push({
            from: path,
            to: matched[0] ?? (arg.startsWith('/') ? arg : pattern),
            line: st.line,
            raw: lines[st.line - 1]?.trim() ?? st.raw,
            glob: arg,
            matched,
            missing: matched.length === 0,
          });
          if (!matched.length) {
            issues.push({ file: path, line: st.line, severity: 'warning', message: `Include 未匹配到文件：${arg}` });
          }
          for (const child of matched) {
            const expanded = expand(child, [...via, path], currentMatch);
            for (const node of expanded) {
              node.fromInclude = true;
              local.push(node);
            }
          }
        }
        continue;
      }

      if (st.key === 'Match') {
        currentMatch = st.args.length ? st.args : null;
        continue;
      }

      const node: ConfigNode = {
        key: st.key,
        args: st.args,
        raw: st.raw,
        file: path,
        line: st.line,
        via: [...via, path],
        block: st.match ? [`Match ${st.match.join(' ')}`] : [],
        index: idx++,
        fromInclude: via.length > 0,
      };
      flat.push(node);
      local.push(node);
      // Only global (non-Match) directives go to the top-level list; Match
      // directives are represented virtually with their block label.
      if (st.match) {
        const matchName = `Match ${st.match.join(' ')}`;
        let group = nodes.find((n) => n.key === matchName && n.file === path && !st.match);
        if (!group) {
          group = { key: matchName, args: st.match, raw: matchName, file: path, line: 0, via: [...via, path], block: [], children: [], index: idx++ };
          nodes.push(group);
        }
        group.children!.push(node);
      }
    }
    stack.pop();
    return local;
  };

  const matched = expand(root, [], null);
  nodes.unshift(...matched);

  return {
    kind: 'sshd',
    root,
    files: [...new Set(files)],
    nodes,
    flat,
    includes,
    issues,
    stats: { statements: flat.length, files: new Set(files).size, bytes: bundle.files.get(root)?.size ?? 0 },
    availableFiles: bundle.order,
    contents: Object.fromEntries(bundle.order.map((p) => [p, bundle.files.get(p)?.content ?? ''])),
  };
}

/** sshd semantics: the first obtained value wins. Global scope only. */
export function sshEffective(model: ConfigFileModel): Map<string, ConfigNode> {
  const map = new Map<string, ConfigNode>();
  for (const node of model.flat) {
    if (node.block.length) continue; // Match-scoped
    const key = node.key.toLowerCase();
    if (key === 'match' || key === 'include') continue;
    if (!map.has(key)) map.set(key, node);
  }
  return map;
}
