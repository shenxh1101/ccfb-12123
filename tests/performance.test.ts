import { describe, expect, it } from 'vitest';
import rulesJson from '../src/data/rules/baseline-rules.json';
import { BASE_BUNDLES } from '../src/data/base';
import { DEMO_HOSTS, makeBulkFleet } from '../src/data/demo/hosts';
import { makeBundle } from '../src/engine/fixtures';
import { groupImportedFiles } from '../src/engine/import';
import { scanHost, validateRuleFile } from '../src/engine/scanner';
import type { RuleFile } from '../src/engine/types';
import type { ImportedFile } from '../src/engine/import';

const { rules } = validateRuleFile(rulesJson as unknown as RuleFile);

/** Simulate a directory import: hundreds of files across many hosts, with
 *  distractor files that must be filtered out. */
function syntheticImport(hostCount: number): ImportedFile[] {
  const files: ImportedFile[] = [];
  const fleet = makeBulkFleet(hostCount);
  for (const host of fleet) {
    for (const f of host.files) {
      files.push({ path: `bundle/${host.name}${f.relativePath}`, content: f.content });
    }
    // Distractors a real /etc drop would contain.
    files.push({ path: `bundle/${host.name}/etc/passwd`, content: 'root:x:0:0:root:/root:/bin/bash\n' });
    files.push({ path: `bundle/${host.name}/etc/hosts`, content: '127.0.0.1 localhost\n' });
    files.push({ path: `bundle/${host.name}/etc/ssl/certs/ca.pem`, content: '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n' });
    files.push({ path: `bundle/${host.name}/usr/share/doc/readme.txt`, content: 'not a config\n'.repeat(50) });
    files.push({ path: `bundle/${host.name}/var/lib/blob.bin`, content: '\u0000\u0001\u0002binary'.repeat(100) });
  }
  return files;
}

describe('batch import performance', () => {
  it('groups 300 hosts / 2400 files quickly and filters distractors', () => {
    const files = syntheticImport(300);
    expect(files.length).toBeGreaterThanOrEqual(2400);
    const started = performance.now();
    const batch = groupImportedFiles(files);
    const elapsed = performance.now() - started;
    expect(batch.hosts.length).toBe(300);
    expect(batch.skipped.length).toBeGreaterThan(0);
    // 300 hosts in well under 2s on a laptop; guard generously for CI.
    expect(elapsed).toBeLessThan(2000);
    expect(batch.hosts.every((h) => h.kinds.length > 0)).toBe(true);
    expect(batch.hosts[0].files.some((f) => f.relativePath === '/etc/passwd')).toBe(false);
  });

  it('scans a 120-host fleet of ~1000 files under a few seconds', () => {
    const fleet = makeBulkFleet(120);
    const bundles = fleet.map((h) => makeBundle(h.name, h.files, 'demo'));
    const fileCount = bundles.reduce((a, b) => a + b.order.length, 0);
    expect(fileCount).toBeGreaterThan(500);
    const started = performance.now();
    const hosts = bundles.map((b) => scanHost(b, rules, ['sshd', 'nginx', 'sysctl']));
    const elapsed = performance.now() - started;
    expect(hosts.length).toBe(120);
    expect(hosts.every((h) => h.summary.total === rules.length)).toBe(true);
    expect(elapsed).toBeLessThan(4000);
    // Guard against accidental quadratic behaviour in parsers (sub-ms per host).
    expect(elapsed / hosts.length).toBeLessThan(60);
  });

  it('handles a single very large config file without blowing up', () => {
    const servers = Array.from({ length: 1200 }, (_, i) => `    server {\n        listen 8${String(i).padStart(3, '0')} ssl;\n        server_name s${i}.example.com;\n        ssl_certificate /etc/nginx/certs/app.crt;\n        location /${i}/ { autoindex off; }\n    }`).join('\n');
    const content = `events { worker_connections 1024; }\nhttp {\n    server_tokens off;\n${servers}\n}\n`;
    const bundle = makeBundle('big', [
      { relativePath: '/etc/nginx/nginx.conf', content },
      { relativePath: '/etc/nginx/certs/app.crt', content: 'cert' },
    ]);
    const started = performance.now();
    const result = scanHost(bundle, rules.filter((r) => r.kind === 'nginx'), ['nginx']);
    expect(performance.now() - started).toBeLessThan(3000);
    expect(result.summary.total).toBe(rules.filter((r) => r.kind === 'nginx').length);
  });

  it('demo fleet stays a small, fast fixture', () => {
    expect(DEMO_HOSTS.length).toBe(5);
    const files = DEMO_HOSTS.flatMap((h) => h.files);
    expect(files.length).toBeLessThan(40);
    expect(BASE_BUNDLES.sshd.files.length).toBeGreaterThan(1);
  });
});
