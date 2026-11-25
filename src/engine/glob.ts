/** Minimal glob matcher for config include directives.
 *  Supports `*`, `?`, `**` (crosses path separators) and `[abc]` / `[!abc]`. */
import { normalizePath } from './paths';

interface Compiled {
  re: RegExp;
  literalPrefix: string;
}

const cache = new Map<string, Compiled>();

function compile(pattern: string): Compiled {
  const cached = cache.get(pattern);
  if (cached) return cached;
  let re = '';
  let literalPrefix = '';
  let prefixDone = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (!prefixDone && !'*?['.includes(ch)) literalPrefix += ch;
    else prefixDone = true;
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        i++;
        // `**/` also matches zero directories, like bash globstar.
        if (pattern[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (ch === '?') {
      re += '[^/]';
    } else if (ch === '[') {
      let j = i + 1;
      let cls = '';
      if (pattern[j] === '!' || pattern[j] === '^') {
        cls += '^';
        j++;
      }
      let closed = false;
      for (; j < pattern.length; j++) {
        if (pattern[j] === ']' && cls.length > 0) {
          closed = true;
          break;
        }
        cls += pattern[j].replace(/\\/g, '\\\\');
      }
      if (closed) {
        re += `[${cls}]`;
        i = j;
      } else {
        re += '\\[';
      }
    } else if ('\\^$.|+(){}'.includes(ch)) {
      re += `\\${ch}`;
    } else {
      re += ch;
    }
  }
  const compiled = { re: new RegExp(`^${re}$`), literalPrefix };
  cache.set(pattern, compiled);
  return compiled;
}

export function globToRegExp(pattern: string): RegExp {
  return compile(normalizePath(pattern)).re;
}

export function hasGlob(pattern: string): boolean {
  return /[*?[]/.test(pattern);
}

/** Return matching paths in deterministic (sorted) order. */
export function globMatch(pattern: string, paths: Iterable<string>): string[] {
  const re = globToRegExp(pattern);
  const out: string[] = [];
  for (const p of paths) if (re.test(p)) out.push(p);
  return out.sort();
}

/** Directory portion usable for a glob, e.g. `/etc/nginx/conf.d/` */
export function globBaseDir(pattern: string): string {
  const p = normalizePath(pattern);
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}
