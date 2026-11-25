import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { groupImportedFiles, readZipArchive } from '../src/engine/import';
import { DEMO_HOSTS } from '../src/data/demo/hosts';

describe('zip import', () => {
  it('reads a zipped multi-host bundle and groups it like a directory drop', async () => {
    const zip = new JSZip();
    for (const host of DEMO_HOSTS.slice(0, 2)) {
      for (const f of host.files) zip.file(`${host.name}${f.relativePath}`, f.content);
    }
    zip.folder('__MACOSX')?.file('._junk', 'x');
    const blob = await zip.generateAsync({ type: 'blob' });
    const files = await readZipArchive(blob, 'fleet.zip');
    const batch = groupImportedFiles(files);
    expect(batch.hosts.map((h) => h.name)).toEqual(['db-02', 'web-01']);
    expect(batch.hosts.find((h) => h.name === 'web-01')?.files.length).toBe(DEMO_HOSTS[0].files.length);
  });

  it('skips oversized entries inside archives', async () => {
    const zip = new JSZip();
    zip.file('h/etc/ssh/sshd_config', 'PermitRootLogin no\n');
    zip.file('h/big.bin', 'x'.repeat(1024));
    const blob = await zip.generateAsync({ type: 'blob' });
    const files = await readZipArchive(blob, 'one.zip');
    expect(files.some((f) => f.path.endsWith('sshd_config'))).toBe(true);
  });
});
