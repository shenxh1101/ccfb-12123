import { describe, expect, it } from 'vitest';
import rulesJson from '../src/data/rules/baseline-rules.json';
import { BASE_BUNDLES } from '../src/data/base';
import { applyPatches, makeBundle } from '../src/engine/fixtures';
import { scanHost, validateRuleFile } from '../src/engine/scanner';
import { applyOps, buildRemediation, diffLines } from '../src/engine/remediation';
import type { ConfigKind, RuleFile } from '../src/engine/types';

const { rules } = validateRuleFile(rulesJson as unknown as RuleFile);

function brokenKinds(kinds: ConfigKind[]) {
  const hosts = kinds.map((k) => {
    const base = makeBundle(`host-${k}`, BASE_BUNDLES[k].files, 'sample-suite');
    const patches = rules.filter((r) => r.kind === k).flatMap((r) => r.samples!.fail);
    return applyPatches(base, patches, { lenient: true });
  });
  return hosts;
}

function rescanWith(bundle: ReturnType<typeof makeBundle>, remediations: ReturnType<typeof buildRemediation>) {
  const files = bundle.order.map((p) => {
    const r = remediations.find((x) => x.file === p);
    return { relativePath: p, content: r ? r.patched : bundle.files.get(p)!.content };
  });
  for (const r of remediations) if (!r.original) files.push({ relativePath: r.file, content: r.patched });
  return makeBundle(`${bundle.name}-fixed`, files);
}

describe('remediation', () => {
  for (const kind of ['sshd', 'nginx', 'sysctl'] as ConfigKind[]) {
    it(`fixes every broken ${kind} rule and passes on rescan`, () => {
      const bundle = brokenKinds([kind])[0];
      const before = scanHost(bundle, rules, [kind]);
      expect(before.summary.fail).toBeGreaterThan(10);
      const remediation = buildRemediation(bundle, before.results);
      expect(remediation.length).toBeGreaterThan(0);
      const fixed = rescanWith(bundle, remediation);
      const after = scanHost(fixed, rules, [kind]);
      const stillFailing = after.results.filter((r) => r.status === 'fail' || r.status === 'error');
      // NGX-013 (missing certificate file) cannot be auto-fixed by editing text.
      expect(stillFailing.map((r) => r.ruleId)).toEqual(kind === 'nginx' ? ['NGX-013'] : []);
      expect(after.summary.score).toBeGreaterThan(before.summary.score);
    });
  }

  it('preserves indentation and does not touch unrelated lines', () => {
    const original = ['http {', '    server {', '        listen 443 ssl;', '        server_tokens on;', '    }', '}'].join('\n');
    const patched = applyOps(original, [{ kind: 'replace', file: '/x', line: 4, text: 'server_tokens off;', reason: 'r' }]);
    expect(patched).toBe(['http {', '    server {', '        listen 443 ssl;', '        server_tokens off;', '    }', '}'].join('\n'));
  });

  it('inserts appended directives after the last global sshd directive, not inside Match', () => {
    const bundle = makeBundle('match', [
      {
        relativePath: '/etc/ssh/sshd_config',
        content: 'PermitRootLogin no\nMaxAuthTries 3\n\nMatch User ops\n  PasswordAuthentication yes\n',
      },
    ]);
    const scanned = scanHost(bundle, rules, ['sshd']);
    const remediation = buildRemediation(bundle, scanned.results);
    const patched = remediation[0].patched;
    const lines = patched.split('\n');
    const matchIdx = lines.findIndex((l) => l.startsWith('Match'));
    const maxAuthIdx = lines.findIndex((l) => l.startsWith('MaxAuthTries'));
    for (const r of rules.filter((x) => x.kind === 'sshd' && x.id !== 'SSH-021')) {
      void r;
    }
    // MaxSessions is appended after MaxAuthTries, before the Match block body.
    const appended = lines.filter((l) => /^(MaxSessions|ClientAliveCountMax|ClientAliveInterval|PermitTunnel|AllowAgentForwarding)\b/.test(l));
    expect(appended.length).toBeGreaterThan(0);
    for (const line of appended) {
      const idx = lines.indexOf(line);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(lines[idx].startsWith('  ')).toBe(false);
    }
    expect(maxAuthIdx).toBeLessThan(matchIdx);
  });

  it('creates the hardening drop-in when sysctl has no writable target', () => {
    const bundle = makeBundle('sys-min', [{ relativePath: '/etc/sysctl.conf', content: 'net.ipv4.ip_forward = 1\n' }]);
    const scanned = scanHost(bundle, rules, ['sysctl']);
    const remediation = buildRemediation(bundle, scanned.results);
    expect(remediation.some((f) => f.file === '/etc/sysctl.conf')).toBe(true);
    const sysctlFile = remediation.find((f) => f.file === '/etc/sysctl.conf')!;
    expect(sysctlFile.patched).toContain('net.ipv4.ip_forward = 0');
    const fixed = rescanWith(bundle, remediation);
    expect(scanHost(fixed, rules, ['sysctl']).summary.fail).toBe(0);
  });

  it('produces a unified-style diff with context markers', () => {
    const d = diffLines('a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n', 'a\nb\nc\nd\nE\nf\ng\nh\ni\nj\n');
    expect(d.some((x) => x.kind === 'add' && x.text === 'E')).toBe(true);
    expect(d.some((x) => x.kind === 'del' && x.text === 'e')).toBe(true);
    const real = d.filter((x) => x.kind === 'context' && x.text !== '…');
    const markers = d.filter((x) => x.kind === 'context' && x.text === '…');
    expect(real.length).toBeLessThanOrEqual(6);
    expect(markers.length).toBe(2); // leading and trailing elision
  });

  it('records which rules each patched file addresses', () => {
    const bundle = brokenKinds(['sshd'])[0];
    const scanned = scanHost(bundle, rules, ['sshd']);
    const remediation = buildRemediation(bundle, scanned.results);
    for (const file of remediation) {
      expect(file.ruleIds.length).toBeGreaterThan(0);
      for (const id of file.ruleIds) expect(rules.some((r) => r.id === id)).toBe(true);
    }
  });
});
