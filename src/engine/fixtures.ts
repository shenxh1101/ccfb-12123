import type { HostBundle, InputFile, SamplePatch } from './types';
import { normalizePath } from './paths';


export function makeBundle(name: string, files: InputFile[], origin: HostBundle['meta']['origin'] = 'sample-suite'): HostBundle {
  const map = new Map<string, { path: string; content: string; size: number }>();
  for (const f of files) {
    const path = normalizePath(f.relativePath.startsWith('/') ? f.relativePath : `/${f.relativePath}`);
    map.set(path, { path, content: f.content, size: f.size ?? new Blob([f.content]).size });
  }
  const order = [...map.keys()].sort();
  const totalBytes = order.reduce((a, p) => a + (map.get(p)?.size ?? 0), 0);
  return {
    name,
    files: map,
    order,
    meta: { origin, fileCount: map.size, totalBytes },
  };
}

export function cloneBundle(bundle: HostBundle, name = bundle.name): HostBundle {
  const files = new Map(bundle.files);
  return { ...bundle, name, files, order: [...bundle.order] };
}

/** Apply textual patches (used to build the per-rule sample fixtures). */
export function applyPatches(bundle: HostBundle, patches: SamplePatch[], opts: { lenient?: boolean } = {}): HostBundle {
  const next = cloneBundle(bundle);
  for (const p of patches) {
    const path = normalizePath(p.file);
    if (p.removeFile) {
      next.files.delete(path);
      next.order = next.order.filter((x) => x !== path);
      continue;
    }
    const existing = next.files.get(path);
    let content = existing?.content ?? '';
    if (p.find !== undefined) {
      const occurrence = p.occurrence ?? 1;
      let idx = -1;
      let from = 0;
      for (let i = 0; i < occurrence; i++) {
        idx = content.indexOf(p.find, from);
        if (idx < 0) break;
        from = idx + p.find.length;
      }
      if (idx < 0) {
        if (opts.lenient) continue;
        throw new Error(`样例补丁未找到目标文本 [${path}]：${p.find.slice(0, 60)}`);
      }
      content = content.slice(0, idx) + (p.replace ?? '') + content.slice(idx + p.find.length);
    }
    if (p.replace !== undefined && p.find === undefined) content = p.replace;
    if (p.append) content = content + (content.endsWith('\n') ? '' : '\n') + p.append;
    next.files.set(path, { path, content, size: new Blob([content]).size });
    if (!next.order.includes(path)) next.order = [...next.order, path].sort();
  }
  next.meta = { ...next.meta, fileCount: next.files.size };
  return next;
}
