import type { ConfigFileModel, ConfigNode, HostBundle, IncludeEdge, ParseIssue } from '../types';
import { dirname, splitLines } from '../paths';
import { globMatch } from '../glob';

interface Token {
  value: string;
  line: number;
  column: number;
  /** true when the token was a quoted string */
  quoted?: boolean;
}

interface RawStmt {
  key: string;
  args: string[];
  raw: string;
  line: number;
  column: number;
  block: boolean;
}

/** Tokenize an nginx config file into statements with block markers. */
function tokenize(content: string, file: string, issues: ParseIssue[]): RawStmt[] {
  const lines = splitLines(content);
  const stmts: RawStmt[] = [];
  let tokens: Token[] = [];
  let quote: string | null = null;
  let escaped = false;
  let comment = false;
  let cur = '';
  let tokenStart: { line: number; col: number } | null = null;

  const pushToken = () => {
    if (tokenStart && cur.length >= 0) {
      tokens.push({ value: cur, line: tokenStart.line, column: tokenStart.col });
    }
    cur = '';
    tokenStart = null;
  };

  const flushStatement = (block: boolean, line: number) => {
    if (!tokens.length) return;
    const first = tokens[0];
    const stmt: RawStmt = {
      key: first.value,
      args: tokens.slice(1).map((t) => t.value),
      raw: lines[line - 1]?.trim() ?? tokens.map((t) => t.value).join(' '),
      line: first.line,
      column: first.column,
      block,
    };
    // Multi-line statements: capture a compact raw form from tokens.
    if (!stmt.raw || !stmt.raw.startsWith(first.value)) {
      stmt.raw = [stmt.key, ...stmt.args].join(' ') + (block ? ' {' : ';');
    }
    stmts.push(stmt);
    tokens = [];
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineNo = li + 1;
    comment = false;
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      if (comment) break;
      if (escaped) {
        cur += ch;
        escaped = false;
        continue;
      }
      if (quote) {
        if (ch === '\\' && quote === '"') {
          escaped = true;
          continue;
        }
        if (ch === quote) {
          quote = null;
          pushToken();
          // mark last as quoted
          tokens[tokens.length - 1].quoted = true;
          continue;
        }
        cur += ch;
        continue;
      }
      if (ch === '#') {
        comment = true;
        break;
      }
      if (/\s/.test(ch)) {
        if (tokenStart) pushToken();
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        if (!tokenStart) tokenStart = { line: lineNo, col: ci + 1 };
        continue;
      }
      if (ch === ';') {
        if (tokenStart) pushToken();
        flushStatement(false, lineNo);
        continue;
      }
      if (ch === '{') {
        if (tokenStart) pushToken();
        flushStatement(true, lineNo);
        continue;
      }
      if (ch === '}') {
        if (tokenStart) pushToken();
        // `}` terminates a block; represent as sentinel handled by caller
        stmts.push({ key: '}', args: [], raw: '}', line: lineNo, column: ci + 1, block: false });
        continue;
      }
      if (!tokenStart) tokenStart = { line: lineNo, col: ci + 1 };
      cur += ch;
    }
    if (quote) {
      issues.push({ file, line: lineNo, severity: 'error', message: '引号未闭合，行内容被忽略' });
      quote = null;
      cur = '';
      tokenStart = null;
    } else if (tokenStart) {
      pushToken();
    }
  }
  if (tokens.length) {
    flushStatement(false, tokens[0].line);
    issues.push({ file, line: tokens[0]?.line ?? 1, severity: 'warning', message: '文件末尾存在缺少分号的指令' });
  }
  return stmts;
}

export function findNginxRoots(bundle: HostBundle): string[] {
  const candidates = [
    '/etc/nginx/nginx.conf',
    '/usr/local/nginx/conf/nginx.conf',
    '/etc/openresty/nginx.conf',
    '/etc/tengine/nginx.conf',
  ].filter((p) => bundle.files.has(p));
  const extra = bundle.order.filter(
    (p) => /nginx\.conf$/.test(p) && !candidates.includes(p) && !/\/conf\.d\/|\/sites-|available|enabled/.test(p),
  );
  return [...candidates, ...extra];
}

interface BlockCtx {
  key: string;
  endLine?: number;
  children: ConfigNode[];
}

export function parseNginx(bundle: HostBundle): ConfigFileModel {
  const root = findNginxRoots(bundle)[0] ?? '/etc/nginx/nginx.conf';
  const issues: ParseIssue[] = [];
  const includes: IncludeEdge[] = [];
  const files: string[] = [];
  const flat: ConfigNode[] = [];
  const includeStack: string[] = [];
  let stmtIndex = 0;

  /** `inheritedBlock` carries the enclosing blocks when an include appears
   *  inside a server/location, so expanded directives keep their nesting. */
  const expandFile = (path: string, via: string[], inheritedBlock: string[] = []): ConfigNode[] => {
    const source = bundle.files.get(path);
    if (!source) return [];
    if (includeStack.includes(path)) {
      includes.push({
        from: via[via.length - 1] ?? path,
        to: path,
        line: 0,
        raw: 'include',
        glob: path,
        matched: [],
        cycle: true,
      });
      issues.push({ file: path, line: 0, severity: 'error', message: `检测到 include 循环引用：${[...via, path].join(' → ')}` });
      return [];
    }
    includeStack.push(path);
    files.push(path);
    const stmts = tokenize(source.content, path, issues);
    const lines = splitLines(source.content);

    const topNodes: ConfigNode[] = [];
    const stack: BlockCtx[] = [{ key: '', children: topNodes }];

    for (const stmt of stmts) {
      if (stmt.key === '}' && !stmt.block) {
        if (stack.length > 1) {
          const ctx = stack.pop()!;
          const parent = stack[stack.length - 1];
          const node = parent.children[parent.children.length - 1];
          if (node) node.endLine = stmt.line;
          void ctx;
        } else {
          issues.push({ file: path, line: stmt.line, severity: 'warning', message: '多余的右花括号' });
        }
        continue;
      }

      if (stmt.key === 'include' && !stmt.block) {
        const target = stmt.args[0];
        if (!target) {
          issues.push({ file: path, line: stmt.line, severity: 'warning', message: 'include 指令缺少路径参数' });
          continue;
        }
        const pattern = target.startsWith('/') ? target : `${dirname(path)}/${target}`;
        const matched = globMatch(pattern, bundle.order);
        const edge: IncludeEdge = {
          from: path,
          to: matched[0] ?? pattern,
          line: stmt.line,
          raw: lines[stmt.line - 1]?.trim() ?? stmt.raw,
          glob: target,
          matched,
          missing: matched.length === 0,
        };
        includes.push(edge);
        if (!matched.length) {
          issues.push({ file: path, line: stmt.line, severity: 'warning', message: `include 未匹配到文件：${target}` });
        }
        const ctx = stack[stack.length - 1];
        const currentBlock = [...inheritedBlock, ...stack.slice(1).map((b) => b.key)];
        for (const child of matched) {
          const expanded = expandFile(child, [...via, path], currentBlock);
          for (const node of expanded) {
            node.fromInclude = true;
            ctx.children.push(node);
          }
        }
        continue;
      }

      const node: ConfigNode = {
        key: stmt.key,
        args: stmt.args,
        raw: stmt.raw,
        file: path,
        line: stmt.line,
        column: stmt.column,
        via: [...via, path],
        block: [...inheritedBlock, ...stack.slice(1).map((b) => b.key)],
        index: stmtIndex++,
        fromInclude: via.length > 0,
      };
      flat.push(node);
      const ctx = stack[stack.length - 1];
      ctx.children.push(node);

      if (stmt.block) {
        node.children = [];
        stack.push({ key: stmt.key, children: node.children });
      }
    }

    if (stack.length > 1) {
      issues.push({ file: path, line: lines.length, severity: 'error', message: `存在 ${stack.length - 1} 个未闭合的配置块` });
    }
    includeStack.pop();
    return topNodes;
  };

  const nodes = expandFile(root, []);
  const bytes = bundle.files.get(root)?.size ?? 0;

  return {
    kind: 'nginx',
    root,
    files: [...new Set(files)],
    nodes,
    flat,
    includes,
    issues,
    stats: { statements: flat.length, files: new Set(files).size, bytes },
    availableFiles: bundle.order,
    contents: Object.fromEntries(bundle.order.map((p) => [p, bundle.files.get(p)?.content ?? ''])),
  };
}

/** Walk all nodes depth-first. */
export function walkNginx(nodes: ConfigNode[], visit: (node: ConfigNode, path: ConfigNode[]) => void, path: ConfigNode[] = []): void {
  for (const n of nodes) {
    visit(n, [...path, n]);
    if (n.children?.length) walkNginx(n.children, visit, [...path, n]);
  }
}
