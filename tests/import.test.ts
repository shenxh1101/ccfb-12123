import { describe, expect, it } from 'vitest';
import { groupImportedFiles } from '../src/engine/import';

const f = (path: string, content = 'x') => ({ path, content });

describe('batch directory import', () => {
  it('groups hosts by the segment before /etc', () => {
    const batch = groupImportedFiles([
      f('drop/web-01/etc/ssh/sshd_config'),
      f('drop/web-01/etc/nginx/nginx.conf'),
      f('drop/web-02/etc/ssh/sshd_config'),
      f('drop/web-02/etc/nginx/nginx.conf'),
    ]);
    expect(batch.hosts.map((h) => h.name)).toEqual(['web-01', 'web-02']);
    expect(batch.hosts[0].files.map((x) => x.relativePath).sort()).toEqual(['/etc/nginx/nginx.conf', '/etc/ssh/sshd_config']);
    expect(batch.hosts[0].prefix).toBe('web-01');
  });

  it('treats a single host tree without a host directory as one host', () => {
    const batch = groupImportedFiles([
      f('baseline/etc/ssh/sshd_config'),
      f('baseline/etc/sysctl.conf'),
    ]);
    expect(batch.hosts).toHaveLength(1);
    expect(batch.hosts[0].name).toBe('baseline');
    expect(batch.hosts[0].kinds.sort()).toEqual(['sshd', 'sysctl']);
  });

  it('canonicalises loose files dropped without directory structure', () => {
    const batch = groupImportedFiles([
      f('sshd_config'),
      f('nginx.conf'),
      f('conf.d/site.conf'),
      f('sysctl.conf'),
      f('sysctl.d/99-hardening.conf'),
    ]);
    expect(batch.hosts).toHaveLength(1);
    expect(batch.hosts[0].files.map((x) => x.relativePath).sort()).toEqual([
      '/etc/nginx/conf.d/site.conf',
      '/etc/nginx/nginx.conf',
      '/etc/ssh/sshd_config',
      '/etc/sysctl.conf',
      '/etc/sysctl.d/99-hardening.conf',
    ]);
  });

  it('skips binaries, macOS metadata, huge files and duplicate paths', () => {
    const batch = groupImportedFiles([
      f('h/etc/ssh/sshd_config', 'PermitRootLogin no'),
      f('h/etc/ssh/sshd_config', 'PermitRootLogin yes'),
      f('h/.DS_Store', 'junk'),
      f('__MACOSX/h/etc/ssh/sshd_config', 'junk'),
      f('h/usr/bin/blob.bin', '\u0000\u0000\u0000'),
      { path: 'h/etc/nginx/nginx.conf', content: '', size: 9 * 1024 * 1024, tooLarge: true },
    ]);
    expect(batch.hosts).toHaveLength(1);
    expect(batch.hosts[0].files.map((x) => x.relativePath)).toEqual(['/etc/ssh/sshd_config']);
    expect(batch.hosts[0].files[0].content).toBe('PermitRootLogin no');
    expect(batch.skipped.length).toBeGreaterThanOrEqual(4);
    expect(batch.warnings.some((w) => w.includes('重复文件'))).toBe(true);
  });

  it('drops hosts with no recognised config and reports them', () => {
    const batch = groupImportedFiles([
      f('web-01/etc/ssh/sshd_config'),
      f('agent-02/etc/hosts', '127.0.0.1 localhost'),
    ]);
    expect(batch.hosts.map((h) => h.name)).toEqual(['web-01']);
    expect(batch.warnings.some((w) => w.includes('agent-02'))).toBe(true);
  });

  it('keeps certificate and mime files needed by nginx checks', () => {
    const batch = groupImportedFiles([
      f('h/etc/nginx/nginx.conf'),
      f('h/etc/nginx/mime.types'),
      f('h/etc/nginx/certs/app.crt'),
      f('h/etc/nginx/certs/app.key'),
      f('h/etc/passwd'),
    ]);
    expect(batch.hosts[0].files.map((x) => x.relativePath)).toContain('/etc/nginx/certs/app.crt');
    expect(batch.hosts[0].files.map((x) => x.relativePath)).not.toContain('/etc/passwd');
  });

  it('de-duplicates host names deterministically', () => {
    const batch = groupImportedFiles([
      f('a/web/etc/ssh/sshd_config'),
      f('b/web/etc/ssh/sshd_config'),
    ]);
    expect(batch.hosts.map((h) => h.name)).toEqual(['web', 'web-2']);
  });
});
