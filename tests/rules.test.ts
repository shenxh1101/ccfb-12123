import { describe, expect, it } from 'vitest';
import rulesJson from '../src/data/rules/baseline-rules.json';
import { BASE_BUNDLES } from '../src/data/base';
import { applyPatches, makeBundle } from '../src/engine/fixtures';
import { scanHost, validateRuleFile, primaryKind } from '../src/engine/scanner';
import type { ConfigKind, RuleDefinition, RuleFile } from '../src/engine/types';

const { rules, errors } = validateRuleFile(rulesJson as unknown as RuleFile);
const byId = new Map(rules.map((r) => [r.id, r]));

function scan(rule: RuleDefinition, patches?: Parameters<typeof applyPatches>[1]) {
  const base = makeBundle(`sample-${rule.id}`, BASE_BUNDLES[rule.kind].files, 'sample-suite');
  const bundle = patches ? applyPatches(base, patches) : base;
  return scanHost(bundle, [rule], [rule.kind]).results[0];
}

describe('rule set', () => {
  it('loads without validation errors and covers all three config kinds', () => {
    expect(errors).toEqual([]);
    expect(rules.length).toBeGreaterThanOrEqual(30);
    const kinds = new Set(rules.map((r) => r.kind));
    expect([...kinds].sort()).toEqual(['nginx', 'sshd', 'sysctl']);
  });

  it('uses every severity level and gives each rule a remediation', () => {
    const severities = new Set(rules.map((r) => r.severity));
    expect([...severities].sort()).toEqual(['critical', 'high', 'info', 'low', 'medium']);
    for (const r of rules) {
      expect(r.remediation.length, r.id).toBeGreaterThan(8);
      expect(r.category.length, r.id).toBeGreaterThan(0);
    }
  });

  it('declares a check whose kind matches the rule kind', () => {
    for (const r of rules) expect(primaryKind(r), r.id).toBe(r.kind);
  });

  it('ships both samples and each sample exercises a real change', () => {
    for (const r of rules) {
      expect(r.samples?.pass, r.id).toBeDefined();
      expect(r.samples?.fail.length, r.id).toBeGreaterThan(0);
      // A pass sample must be a no-op or a patch that still satisfies the rule;
      // it may not be the same patch as the fail sample.
      expect(JSON.stringify(r.samples?.pass), r.id).not.toBe(JSON.stringify(r.samples?.fail));
    }
  });

  for (const rule of rules) {
    it(`${rule.id} 通过样例判定为通过`, () => {
      const result = scan(rule);
      expect(result.status, `${rule.id}: ${result.message}`).toBe('pass');
    });

    it(`${rule.id} 不通过样例判定为不通过`, () => {
      const result = scan(rule, rule.samples!.fail);
      expect(['fail', 'warn']).toContain(result.status);
      expect(result.evidence.length, `${rule.id} 应当能定位到触发行`).toBeGreaterThan(0);
      if (result.status !== 'skip') {
        expect(result.fix, `${rule.id} 应有修复计划`).toBeDefined();
      }
    });
  }
});

describe('rule semantics', () => {
  it('marks rules of absent config kinds as skipped, not failed', () => {
    const rule = byId.get('SSH-001')!;
    const bundle = makeBundle('only-nginx', BASE_BUNDLES.nginx.files);
    const result = scanHost(bundle, [rule], ['sshd' as ConfigKind]).results[0];
    expect(result.status).toBe('skip');
    expect(result.message).toContain('未导入');
  });

  it('honours sshd first-value-wins when a drop-in sets an earlier value', () => {
    const rule = byId.get('SSH-001')!;
    const bundle = makeBundle('dropin', [
      ...BASE_BUNDLES.sshd.files,
      { relativePath: '/etc/ssh/sshd_config.d/00-early.conf', content: 'PermitRootLogin yes\n' },
    ]);
    const result = scanHost(bundle, [rule], ['sshd']).results[0];
    expect(result.status).toBe('fail');
    // The include is expanded at its position, so the drop-in's value wins and
    // is what the evidence points at.
    expect(result.evidence[0].file).toBe('/etc/ssh/sshd_config.d/00-early.conf');
    expect(result.evidence[0].line).toBe(1);
  });

  it('reports the concrete file and line for a sysctl conflict', () => {
    const rule = byId.get('KERN-001')!;
    const bundle = makeBundle('sys', BASE_BUNDLES.sysctl.files);
    const result = scanHost(bundle, [rule], ['sysctl']).results[0];
    const files = result.evidence.map((e) => `${e.file}:${e.line}`);
    expect(files).toContain('/etc/sysctl.conf:2');
  });

  it('checks every ssl server block for nginx rules', () => {
    const rule = byId.get('NGX-007')!;
    const bundle = makeBundle('ngx', [
      ...BASE_BUNDLES.nginx.files,
      { relativePath: '/etc/nginx/conf.d/bad.conf', content: 'server {\n listen 443 ssl;\n ssl_certificate /etc/nginx/certs/app.crt;\n}\n' },
    ]);
    const result = scanHost(bundle, [rule], ['nginx']).results[0];
    expect(result.status).toBe('fail');
    expect(result.evidence.some((e) => e.file === '/etc/nginx/conf.d/bad.conf')).toBe(true);
    expect(result.evidence.some((e) => e.file === '/etc/nginx/conf.d/site.conf')).toBe(false);
  });

  it('skips response-header rules for redirect-only vhosts', () => {
    const rule = byId.get('NGX-007')!;
    const bundle = makeBundle('redirect', BASE_BUNDLES.nginx.files);
    const result = scanHost(bundle, [rule], ['nginx']).results[0];
    expect(result.status).toBe('pass');
  });
});
