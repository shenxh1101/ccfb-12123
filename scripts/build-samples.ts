#!/usr/bin/env tsx
/** Regenerate the downloadable sample bundles + a reference report.
 *  Writes into public/samples/ so the built app can serve them. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import rulesJson from '../src/data/rules/baseline-rules.json';
import { DEMO_HOSTS } from '../src/data/demo/hosts';
import { makeBundle } from '../src/engine/fixtures';
import { validateRuleFile, scanHost } from '../src/engine/scanner';
import { buildRemediation } from '../src/engine/remediation';
import { buildReport, reportToJson, reportToMarkdown, remediationToMarkdown } from '../src/engine/report';
import type { RuleFile } from '../src/engine/types';

const outDir = join(process.cwd(), 'public', 'samples');
mkdirSync(outDir, { recursive: true });

const { rules } = validateRuleFile(rulesJson as unknown as RuleFile);

// 1. Demo fleet as a flat file listing (human-friendly, one JSON per host).
for (const host of DEMO_HOSTS) {
  const payload = {
    host: host.name,
    description: host.description,
    files: host.files.map((f) => ({ path: f.relativePath, content: f.content })),
  };
  writeFileSync(join(outDir, `host-${host.name}.json`), JSON.stringify(payload, null, 2) + '\n');
}

// 2. Rule samples as a compact manifest (used by the docs page).
const sampleManifest = rules.map((r) => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  severity: r.severity,
  category: r.category,
  reference: r.reference,
  check: r.check,
  passSample: r.samples?.pass ?? [],
  failSample: r.samples?.fail ?? [],
}));
writeFileSync(join(outDir, 'rule-samples.json'), JSON.stringify(sampleManifest, null, 2) + '\n');

// 3. Reference report for the demo fleet.
const bundles = DEMO_HOSTS.map((h) => makeBundle(h.name, h.files, 'demo'));
const hosts = bundles.map((b) => scanHost(b, rules, ['sshd', 'nginx', 'sysctl']));
const remediations = hosts.flatMap((h) => buildRemediation(bundles.find((b) => b.name === h.host)!, h.results));
const report = buildReport({
  hosts,
  remediations,
  ruleSet: { name: (rulesJson as unknown as RuleFile).name, version: 1, count: rules.length },
  input: {
    hosts: hosts.length,
    files: bundles.reduce((a, b) => a + b.order.length, 0),
    bytes: bundles.reduce((a, b) => a + b.meta.totalBytes, 0),
  },
  durationMs: hosts.reduce((a, h) => a + h.scanMs, 0),
});
writeFileSync(join(outDir, 'report-sample.json'), reportToJson(report));
writeFileSync(join(outDir, 'report-sample.md'), reportToMarkdown(report) + '\n' + remediationToMarkdown(remediations) + '\n');

// 4. Copy the rule file for download.
writeFileSync(join(outDir, 'baseline-rules.json'), readFileSync(join(process.cwd(), 'src/data/rules/baseline-rules.json'), 'utf8'));

console.log(`wrote ${DEMO_HOSTS.length} host fixtures, ${rules.length} rule samples and a reference report to ${outDir}`);
