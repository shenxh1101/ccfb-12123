/// <reference lib="webworker" />
import type { ConfigKind, HostBundle, RuleDefinition } from '../engine/types';
import { scanHost } from '../engine/scanner';

export interface ScanRequest {
  type: 'scan';
  jobId: string;
  hosts: { name: string; files: { relativePath: string; content: string; size?: number }[]; origin: HostBundle['meta']['origin'] }[];
  rules: RuleDefinition[];
  kinds: ConfigKind[];
}

export type ScanResponse =
  | { type: 'progress'; jobId: string; done: number; total: number; host: string }
  | { type: 'host'; jobId: string; index: number; result: ReturnType<typeof scanHost> }
  | { type: 'done'; jobId: string; durationMs: number }
  | { type: 'error'; jobId: string; message: string };

function toBundle(h: ScanRequest['hosts'][number]): HostBundle {
  const files = new Map<string, { path: string; content: string; size: number }>();
  for (const f of h.files) {
    files.set(f.relativePath, {
      path: f.relativePath,
      content: f.content,
      size: f.size ?? new Blob([f.content]).size,
    });
  }
  const order = [...files.keys()].sort();
  return {
    name: h.name,
    files,
    order,
    meta: {
      origin: h.origin,
      fileCount: files.size,
      totalBytes: order.reduce((a, p) => a + (files.get(p)?.size ?? 0), 0),
    },
  };
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (event: MessageEvent<ScanRequest>) => {
  const req = event.data;
  if (req.type !== 'scan') return;
  const started = performance.now();
  try {
    const total = req.hosts.length;
    req.hosts.forEach((h, index) => {
      const bundle = toBundle(h);
      const result = scanHost(bundle, req.rules, req.kinds);
      const response: ScanResponse = { type: 'host', jobId: req.jobId, index, result };
      ctx.postMessage(response);
      ctx.postMessage({ type: 'progress', jobId: req.jobId, done: index + 1, total, host: h.name } satisfies ScanResponse);
    });
    ctx.postMessage({ type: 'done', jobId: req.jobId, durationMs: performance.now() - started } satisfies ScanResponse);
  } catch (err) {
    ctx.postMessage({ type: 'error', jobId: req.jobId, message: (err as Error).message } satisfies ScanResponse);
  }
});
