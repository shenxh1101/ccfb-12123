import JSZip from 'jszip';
import type { ConfigKind, InputFile } from './types';
import { normalizePath } from './paths';

export interface ImportedFile {
  /** Path as reported by the file picker or zip, e.g. `web-01/etc/nginx/nginx.conf`. */
  path: string;
  content: string;
  /** Byte size; when `content` is empty because the file was skipped, this is its real size. */
  size?: number;
  /** True when the file exceeded the size cap and its content was not read. */
  tooLarge?: boolean;
}

export interface ImportedHost {
  name: string;
  /** Prefix stripped from the input paths, shown in the UI. */
  prefix: string;
  files: InputFile[];
  kinds: ConfigKind[];
  bytes: number;
}

export interface BatchImport {
  hosts: ImportedHost[];
  files: number;
  bytes: number;
  skipped: string[];
  warnings: string[];
}

const MAX_FILE_BYTES = 4 * 1024 * 1024;

const IGNORED = [
  /(^|\/)\.DS_Store$/,
  /(^|\/)__MACOSX(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)Thumbs\.db$/,
  /(^|\/)\._.*$/,
  /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|zip|gz|xz|bz2|tar|rpm|deb|so|pyc|class|jar|exe|dll)$/i,
];

const TEXT_HINT = /\.(conf|cnf|cfg|ini|txt|md|json|ya?ml|list|network|service|rules|sh|pem|crt|key|pub|log)$/i;

function isIgnored(path: string): boolean {
  return IGNORED.some((re) => re.test(path));
}

function looksBinary(content: string): boolean {
  if (content.includes('\u0000')) return true;
  const sample = content.slice(0, 4096);
  let control = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c < 9 || (c > 13 && c < 32)) control++;
  }
  return control / Math.max(1, sample.length) > 0.02;
}

/** Files kept even though they carry no directives: certificates are checked
 *  for existence by nginx rules, mime.types is included by nginx.conf. */
const SUPPORT_FILE = /\.(pem|crt|cer|key|pub|csr)$|(^|\/)(mime\.types|issue\.net|moduli|dhparam\.pem|ssl\.conf)$/i;

const KIND_PATTERNS: { kind: ConfigKind; re: RegExp }[] = [
  { kind: 'sshd', re: /(^|\/)sshd_config(\.d\/[^/]+\.conf)?$/ },
  { kind: 'nginx', re: /(^|\/)(nginx\.conf|conf\.d\/[^/]+\.conf|sites-(available|enabled)\/[^/]+|mime\.types)$/ },
  { kind: 'sysctl', re: /(^|\/)(sysctl\.conf|sysctl\.d\/[^/]+\.conf)$/ },
];

/** Map a bare filename or partial path onto the canonical config location. */
function canonicalize(relative: string): string {
  const p = normalizePath(relative);
  if (p.startsWith('/etc/')) return p;
  const segs = p.split('/').filter(Boolean);
  const base = segs[segs.length - 1] ?? '';
  const parent = segs[segs.length - 2] ?? '';
  if (base === 'sshd_config') return '/etc/ssh/sshd_config';
  if (base === 'nginx.conf') return '/etc/nginx/nginx.conf';
  if (parent === 'conf.d' || parent === 'sites-enabled' || parent === 'sites-available') return `/etc/nginx/${parent}/${base}`;
  if (/^(conf\.d|sites-enabled|sites-available)$/.test(segs[0] ?? '')) return `/etc/nginx/${segs.join('/')}`;
  if (base === 'sysctl.conf') return '/etc/sysctl.conf';
  if (parent === 'sysctl.d') return `/etc/sysctl.d/${base}`;
  if (segs[0] === 'sysctl.d') return `/etc/sysctl.d/${segs.slice(1).join('/')}`;
  if (base === 'mime.types') return '/etc/nginx/mime.types';
  if (/\.conf$/.test(base) && parent) return `/etc/nginx/conf.d/${parent}-${base}`;
  return normalizePath(`/${relative.replace(/^\/+/, '')}`);
}

function isConfigRelevant(path: string): boolean {
  return KIND_PATTERNS.some((k) => k.re.test(path)) || SUPPORT_FILE.test(path);
}

function kindsOf(files: InputFile[]): ConfigKind[] {
  const kinds = new Set<ConfigKind>();
  for (const f of files) {
    for (const k of KIND_PATTERNS) if (k.re.test(f.relativePath)) kinds.add(k.kind);
  }
  return [...kinds];
}

/** Group hundreds of loose files into per-host bundles.
 *  Host boundaries come from the path segment before `etc`; files elsewhere
 *  (e.g. /opt/nginx/conf) attach to the host whose prefix they share. */
export function groupImportedFiles(files: ImportedFile[]): BatchImport {
  const skipped: string[] = [];
  const warnings: string[] = [];

  interface Entry {
    file: ImportedFile;
    segments: string[];
    size: number;
  }
  const usable: Entry[] = [];
  for (const f of files) {
    const raw = f.path.replace(/\\/g, '/');
    if (!raw || raw.endsWith('/')) continue;
    if (isIgnored(raw)) {
      skipped.push(raw);
      continue;
    }
    const size = f.size ?? new Blob([f.content]).size;
    if (f.tooLarge || size > MAX_FILE_BYTES) {
      skipped.push(`${raw}（超过 4 MB，已跳过）`);
      continue;
    }
    if (!TEXT_HINT.test(raw) && looksBinary(f.content)) {
      skipped.push(`${raw}（二进制文件）`);
      continue;
    }
    usable.push({ file: f, segments: raw.split('/').filter(Boolean), size });
  }

  // Pass 1: host prefixes anchored at an `etc` segment.
  const prefixes = new Set<string>();
  for (const u of usable) {
    const idx = u.segments.indexOf('etc');
    if (idx > 0) prefixes.add(u.segments.slice(0, idx).join('/'));
  }
  const prefixList = [...prefixes].sort((a, b) => b.length - a.length);
  // A single leading folder shared by all hosts (e.g. the zip root) is not a host.
  const multiHost = prefixes.size > 1;

  const buckets = new Map<string, InputFile[]>();
  const bucketName = new Map<string, string>();

  for (const u of usable) {
    let hostPrefix = '';
    let rel: string;
    const etcIdx = u.segments.indexOf('etc');
    if (etcIdx >= 0) {
      hostPrefix = u.segments.slice(0, etcIdx).join('/');
      rel = u.segments.slice(etcIdx).join('/');
      if (!multiHost && hostPrefix && rel.split('/').length > 1) {
        // Only one host in the input: its leading folder is the host name.
      }
    } else {
      // Outside /etc — attach to the deepest known host prefix that contains it.
      const owner = prefixList.find((p) => u.segments.join('/').startsWith(`${p}/`));
      if (owner) {
        hostPrefix = owner;
        rel = u.segments.slice(owner.split('/').length).join('/');
      } else if (multiHost && u.segments.length > 2) {
        hostPrefix = u.segments[0];
        rel = u.segments.slice(1).join('/');
      } else {
        rel = u.segments.join('/');
      }
    }
    const path = canonicalize(rel);
    if (path.split('/').includes('..')) {
      skipped.push(u.file.path);
      continue;
    }
    const key = hostPrefix || '__default__';
    const list = buckets.get(key) ?? [];
    if (list.some((x) => x.relativePath === path)) {
      warnings.push(`${hostPrefix ? `${hostPrefix}: ` : ''}重复文件 ${path}，已保留先出现的一份`);
      continue;
    }
    list.push({ relativePath: path, content: u.file.content, size: u.size });
    buckets.set(key, list);
    if (!bucketName.has(key)) bucketName.set(key, hostPrefix);
  }

  if (buckets.size === 0) {
    return { hosts: [], files: 0, bytes: 0, skipped, warnings: [...warnings, '没有找到可解析的配置文件'] };
  }

  // Strip one shared root folder such as `bundle/` when every host is nested in it.
  const allPrefixes = [...buckets.keys()].filter((k) => k !== '__default__');
  let sharedRoot = '';
  if (allPrefixes.length > 1) {
    const firsts = new Set(allPrefixes.map((p) => p.split('/')[0]));
    if (firsts.size === 1) {
      const head = [...firsts][0];
      if (allPrefixes.every((p) => p.includes('/'))) sharedRoot = head;
    }
  }

  const hosts: ImportedHost[] = [];
  for (const [key, fileList] of buckets) {
    const rawPrefix = bucketName.get(key) ?? '';
    const prefix = sharedRoot ? rawPrefix.split('/').slice(1).join('/') : rawPrefix;
    const name = (prefix || rawPrefix).split('/').filter(Boolean).pop() || 'default-host';
    const kinds = kindsOf(fileList);
    if (!kinds.length) {
      warnings.push(`${rawPrefix || name}：未识别到 SSH / Nginx / sysctl 配置，已跳过`);
      skipped.push(...fileList.map((f) => `${rawPrefix ? `${rawPrefix}/` : ''}${f.relativePath}`));
      continue;
    }
    // Drop unrelated /etc noise so bundles stay small and scans stay fast.
    const irrelevant = fileList.filter((f) => !isConfigRelevant(f.relativePath));
    const kept = fileList.filter((f) => isConfigRelevant(f.relativePath));
    if (irrelevant.length) {
      skipped.push(...irrelevant.map((f) => `${rawPrefix ? `${rawPrefix}/` : ''}${f.relativePath}`));
      warnings.push(`${rawPrefix || name}：忽略 ${irrelevant.length} 个与基线无关的文件`);
    }
    kept.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    hosts.push({ name, prefix, files: kept, kinds, bytes: kept.reduce((a, f) => a + (f.size ?? 0), 0) });
  }

  hosts.sort((a, b) => a.name.localeCompare(b.name));
  const seen = new Set<string>();
  for (const h of hosts) {
    let name = h.name;
    let i = 2;
    while (seen.has(name)) name = `${h.name}-${i++}`;
    seen.add(name);
    h.name = name;
  }
  return {
    hosts,
    files: hosts.reduce((a, h) => a + h.files.length, 0),
    bytes: hosts.reduce((a, h) => a + h.bytes, 0),
    skipped,
    warnings,
  };
}

/** Read a FileList from an <input webkitdirectory> or drag-and-drop. */
export async function readFileList(list: FileList | File[]): Promise<ImportedFile[]> {
  const files = [...list];
  const out: ImportedFile[] = [];
  const concurrency = 8;
  let i = 0;
  async function worker() {
    while (i < files.length) {
      const idx = i++;
      const f = files[idx];
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      if (f.size > MAX_FILE_BYTES) {
        out.push({ path: rel, content: '', size: f.size, tooLarge: true });
        continue;
      }
      const text = await f.text();
      out.push({ path: rel, content: text, size: f.size });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return out;
}

/** Expand a zip archive into the same flat file list as a directory import.
 *  Entries are read as text; binary/unrelated entries are filtered downstream. */
export async function readZipArchive(file: File | Blob, name = 'archive.zip'): Promise<ImportedFile[]> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.entries(zip.files).filter(([, entry]) => !entry.dir);
  const out: ImportedFile[] = [];
  const root = name.replace(/\.zip$/i, '');
  for (const [path, entry] of entries) {
    if (isIgnored(path)) continue;
    const size = Number((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0);
    if (size > MAX_FILE_BYTES) {
      out.push({ path: `${root}/${path}`, content: '', size, tooLarge: true });
      continue;
    }
    const content = await entry.async('string');
    out.push({ path: `${root}/${path}`, content, size: content.length });
  }
  return out;
}

/** Zip detection by extension, MIME type, or the local-file-header magic
 *  bytes (`PK\x03\x04`), so renamed archives still import correctly. */
export async function isZipFile(file: File): Promise<boolean> {
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') return true;
  if (file.size < 4) return false;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07);
}
