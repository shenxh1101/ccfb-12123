import { useRef } from 'react';
import type { ConfigKind, HostResult, RuleDefinition } from '../engine/types';
import type { HostEntry } from '../state/store';
import type { ScanRequest, ScanResponse } from '../worker/scan.worker';

export interface ScanRunnerOptions {
  onProgress: (done: number, total: number, host: string) => void;
  onHost: (result: HostResult) => void;
  onDone: (durationMs: number) => void;
  onError: (message: string) => void;
}

/** Fire a scan job in the background. Falls back to the main thread when the
 *  environment has no module-worker support (e.g. some test runners). */
export function useScanRunner(options: ScanRunnerOptions) {
  const workerRef = useRef<Worker | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const jobRef = useRef(0);

  async function runInline(hosts: HostEntry[], rules: RuleDefinition[], kinds: ConfigKind[]) {
    const { scanHost } = await import('../engine/scanner');
    const started = performance.now();
    for (const [i, h] of hosts.entries()) {
      // Yield to the event loop so the progress bar can paint.
      await new Promise((r) => setTimeout(r, 0));
      const result = scanHost(h.bundle, rules, kinds);
      optionsRef.current.onHost(result);
      optionsRef.current.onProgress(i + 1, hosts.length, h.bundle.name);
    }
    optionsRef.current.onDone(performance.now() - started);
  }

  function start(hosts: HostEntry[], rules: RuleDefinition[], kinds: ConfigKind[]) {
    const jobId = `job-${++jobRef.current}`;
    if (typeof Worker === 'undefined') {
      void runInline(hosts, rules, kinds);
      return;
    }
    try {
      // One long-lived worker per session; a fresh job replaces its handler so
      // messages from an older job can never reach the current scan.
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL('../worker/scan.worker.ts', import.meta.url), { type: 'module' });
      }
      const worker = workerRef.current;
      worker.onmessage = (e: MessageEvent<ScanResponse>) => {
        const msg = e.data;
        if (msg.jobId !== jobId) return;
        if (msg.type === 'progress') optionsRef.current.onProgress(msg.done, msg.total, msg.host);
        else if (msg.type === 'host') optionsRef.current.onHost(msg.result);
        else if (msg.type === 'done') optionsRef.current.onDone(msg.durationMs);
        else if (msg.type === 'error') optionsRef.current.onError(msg.message);
      };
      worker.onerror = (e) => {
        optionsRef.current.onError(e.message || '扫描线程异常');
      };
      const payload: ScanRequest = {
        type: 'scan',
        jobId,
        hosts: hosts.map((h) => ({
          name: h.bundle.name,
          origin: h.bundle.meta.origin,
          files: h.bundle.order.map((p) => ({
            relativePath: p,
            content: h.bundle.files.get(p)?.content ?? '',
            size: h.bundle.files.get(p)?.size,
          })),
        })),
        rules,
        kinds,
      };
      worker.postMessage(payload);
    } catch {
      void runInline(hosts, rules, kinds);
    }
  }

  return { start };
}
