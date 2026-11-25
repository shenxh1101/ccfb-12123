/** POSIX-ish virtual filesystem helpers. All config paths are normalised to
 *  absolute paths such as `/etc/nginx/nginx.conf` inside a host bundle. */

export function normalizePath(input: string): string {
  const raw = input.replace(/\\/g, '/').trim();
  const absolute = raw.startsWith('/');
  const parts = raw.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else if (!absolute) out.push('..');
    } else {
      out.push(part);
    }
  }
  return (absolute ? '/' : '') + out.join('/') || (absolute ? '/' : '.');
}

export function dirname(path: string): string {
  const n = normalizePath(path);
  if (n === '/') return '/';
  const i = n.lastIndexOf('/');
  if (i <= 0) return '/';
  return n.slice(0, i);
}

export function basename(path: string): string {
  const n = normalizePath(path);
  const i = n.lastIndexOf('/');
  return i < 0 ? n : n.slice(i + 1);
}

export function joinPath(base: string, ...parts: string[]): string {
  return normalizePath([base.replace(/\/+$/, ''), ...parts].filter(Boolean).join('/'));
}

/** Resolve a path the way a config directive would: absolute stays absolute,
 *  relative is joined to one of the provided bases (first existing wins later). */
export function resolveAgainst(base: string, path: string): string {
  if (path.startsWith('/')) return normalizePath(path);
  return joinPath(base, path);
}

export function relativeTo(root: string, path: string): string {
  const r = normalizePath(root).replace(/\/$/, '');
  const p = normalizePath(path);
  if (p === r) return '';
  if (p.startsWith(r + '/')) return p.slice(r.length + 1);
  return p;
}

export function lineColOf(content: string, offset: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') {
      line++;
      last = i;
    }
  }
  return { line, column: offset - last };
}

export function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

export function leadingWhitespace(line: string): string {
  return (line.match(/^[ \t]*/) ?? [''])[0];
}

export function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1).replace(/\\(["'\\])/g, '$1');
  }
  return v;
}

/** Split on whitespace while respecting single and double quotes. */
export function splitArgs(input: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let escaped = false;
  for (const ch of input) {
    if (escaped) {
      cur += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && quote === '"') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
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

/** Remove an unquoted comment from a line. `#` inside quotes is preserved. */
export function stripComment(input: string, markers: string[] = ['#']): string {
  let quote: string | null = null;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && quote === '"') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (markers.includes(ch)) return input.slice(0, i);
  }
  return input;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
