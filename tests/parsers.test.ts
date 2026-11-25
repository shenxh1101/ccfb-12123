import { describe, expect, it } from 'vitest';
import { makeBundle } from '../src/engine/fixtures';
import { parseNginx, walkNginx } from '../src/engine/parsers/nginx';
import { parseSshd, sshEffective } from '../src/engine/parsers/sshd';
import { parseSysctl, sysctlEffective } from '../src/engine/parsers/sysctl';
import { globMatch, globToRegExp } from '../src/engine/glob';
import { normalizePath } from '../src/engine/paths';

const f = (relativePath: string, content: string) => ({ relativePath, content });

describe('path + glob helpers', () => {
  it('normalises dot segments', () => {
    expect(normalizePath('/etc/nginx/../nginx/./conf.d/a.conf')).toBe('/etc/nginx/conf.d/a.conf');
    expect(normalizePath('a/b/../../c')).toBe('c');
  });

  it('matches nginx-style include globs', () => {
    const paths = ['/etc/nginx/conf.d/a.conf', '/etc/nginx/conf.d/b.conf', '/etc/nginx/conf.d/sub/c.conf'];
    expect(globMatch('/etc/nginx/conf.d/*.conf', paths)).toEqual(['/etc/nginx/conf.d/a.conf', '/etc/nginx/conf.d/b.conf']);
    expect(globMatch('/etc/nginx/conf.d/**/*.conf', paths)).toEqual([
      '/etc/nginx/conf.d/a.conf',
      '/etc/nginx/conf.d/b.conf',
      '/etc/nginx/conf.d/sub/c.conf',
    ]);
    expect(globToRegExp('/etc/ssh/sshd_config.d/*').test('/etc/ssh/sshd_config.d/50-cloud.conf')).toBe(true);
  });
});

describe('nginx parser', () => {
  const bundle = makeBundle('h1', [
    f('/etc/nginx/nginx.conf', `http {
  server_tokens off;
  include /etc/nginx/conf.d/*.conf;
  server {
    listen 80;
    server_name inline.example.com;
    location / { autoindex off; }
  }
}`),
    f('/etc/nginx/conf.d/a.conf', `server {
  listen 443 ssl;
  server_name a.example.com;
  # a comment with { braces } and 'quotes'
  ssl_certificate "/etc/nginx/certs/a.crt";
  add_header X-Frame-Options "SAMEORIGIN" always;
}`),
    f('/etc/nginx/conf.d/b.conf', `server { listen 443; server_name b.example.com; }`),
  ]);

  it('expands includes in place and records provenance', () => {
    const model = parseNginx(bundle);
    expect(model.files).toEqual(['/etc/nginx/nginx.conf', '/etc/nginx/conf.d/a.conf', '/etc/nginx/conf.d/b.conf']);
    const servers: string[] = [];
    walkNginx(model.nodes, (n) => {
      if (n.key === 'server_name') servers.push(n.args.join(' '));
    });
    expect(servers.sort()).toEqual(['a.example.com', 'b.example.com', 'inline.example.com']);
    const fromInclude = model.flat.filter((n) => n.fromInclude);
    expect(fromInclude.length).toBeGreaterThan(0);
    expect(fromInclude[0].via).toEqual(['/etc/nginx/nginx.conf', '/etc/nginx/conf.d/a.conf']);
    expect(fromInclude[0].file).toBe('/etc/nginx/conf.d/a.conf');
  });

  it('keeps hashes inside quotes and reports unmatched includes', () => {
    const b = makeBundle('h2', [
      f('/etc/nginx/nginx.conf', 'http {\n  include /etc/nginx/missing/*.conf;\n  add_header X "a#b" always;\n}'),
    ]);
    const model = parseNginx(b);
    expect(model.issues.some((i) => i.message.includes('未匹配到文件'))).toBe(true);
    const header = model.flat.find((n) => n.key === 'add_header');
    expect(header?.args).toEqual(['X', 'a#b', 'always']);
  });

  it('detects include cycles without hanging', () => {
    const b = makeBundle('h3', [
      f('/etc/nginx/nginx.conf', 'http {\n include /etc/nginx/conf.d/a.conf;\n}'),
      f('/etc/nginx/conf.d/a.conf', 'include /etc/nginx/nginx.conf;'),
    ]);
    const model = parseNginx(b);
    expect(model.includes.some((i) => i.cycle)).toBe(true);
  });
});

describe('sshd parser', () => {
  it('applies first-value-wins semantics across includes', () => {
    const bundle = makeBundle('h4', [
      f('/etc/ssh/sshd_config', `Include /etc/ssh/sshd_config.d/*.conf
PermitRootLogin no
PasswordAuthentication no
MaxAuthTries 3
Match User ops
  PasswordAuthentication yes
`),
      f('/etc/ssh/sshd_config.d/99-override.conf', 'PermitRootLogin yes\nMaxAuthTries 9\n'),
    ]);
    const model = parseSshd(bundle);
    const eff = sshEffective(model);
    // Include expands in place *before* the main file's own directives, so the
    // drop-in's PermitRootLogin yes is the first obtained value (sshd first-wins).
    expect(eff.get('permitrootlogin')?.args[0]).toBe('yes');
    expect(eff.get('maxauthtries')?.args[0]).toBe('9');
    expect(model.includes[0].matched).toEqual(['/etc/ssh/sshd_config.d/99-override.conf']);
    // Match-block override is visible but not part of the global effective value
    expect(eff.get('passwordauthentication')?.args[0]).toBe('no');
    const matchNode = model.flat.find((n) => n.key === 'PasswordAuthentication' && n.block.length);
    expect(matchNode?.block[0]).toContain('Match User ops');
  });

  it('supports Key=Value syntax and comments', () => {
    const bundle = makeBundle('h5', [f('/etc/ssh/sshd_config', 'PermitRootLogin=no # inline\n# PermitRootLogin yes\nX11Forwarding no\n')]);
    const eff = sshEffective(parseSshd(bundle));
    expect(eff.get('permitrootlogin')?.args[0]).toBe('no');
    expect(eff.get('x11forwarding')?.args[0]).toBe('no');
  });
});

describe('sysctl parser', () => {
  it('loads files in systemd order with last-wins', () => {
    const bundle = makeBundle('h6', [
      f('/etc/sysctl.d/10-vendor.conf', 'net.ipv4.ip_forward = 1\nkernel.sysrq = 1\n'),
      f('/etc/sysctl.d/99-hardening.conf', 'net.ipv4.ip_forward = 0\n'),
      f('/etc/sysctl.conf', 'kernel.sysrq = 0\nkernel.randomize_va_space = 2\n'),
    ]);
    const model = parseSysctl(bundle);
    const eff = sysctlEffective(model);
    expect(eff.get('net.ipv4.ip_forward')?.args[0]).toBe('0');
    expect(eff.get('kernel.sysrq')?.args[0]).toBe('0');
    expect(eff.get('kernel.randomize_va_space')?.args[0]).toBe('2');
    expect(model.files).toEqual(['/etc/sysctl.d/10-vendor.conf', '/etc/sysctl.d/99-hardening.conf', '/etc/sysctl.conf']);
  });

  it('ignores comments, semicolons and dash-prefixed override files', () => {
    const bundle = makeBundle('h7', [
      f('/etc/sysctl.d/50-base.conf', 'vm.swappiness = 60 # comment\n; whole-line comment\n'),
      f('/etc/sysctl.d/-90-lock.conf', 'vm.swappiness = 10\n'),
    ]);
    const model = parseSysctl(bundle);
    expect(sysctlEffective(model).get('vm.swappiness')?.args[0]).toBe('60');
  });
});

describe('multi-level include expansion', () => {
  it('follows nginx include chains three levels deep with provenance', () => {
    const bundle = makeBundle('nested', [
      f('/etc/nginx/nginx.conf', 'http {\n  include /etc/nginx/sites-enabled/*;\n}\n'),
      f('/etc/nginx/sites-enabled/app.conf', 'server {\n  listen 443 ssl;\n  include /etc/nginx/snippets/headers.conf;\n}\n'),
      f('/etc/nginx/snippets/headers.conf', 'add_header X-Frame-Options "DENY" always;\n'),
    ]);
    const model = parseNginx(bundle);
    const header = model.flat.find((n) => n.key === 'add_header');
    expect(header).toBeDefined();
    expect(header!.via).toEqual([
      '/etc/nginx/nginx.conf',
      '/etc/nginx/sites-enabled/app.conf',
      '/etc/nginx/snippets/headers.conf',
    ]);
    expect(header!.block).toEqual(['http', 'server']);
    expect(header!.file).toBe('/etc/nginx/snippets/headers.conf');
  });

  it('follows sshd Include chains and keeps the match scope', () => {
    const bundle = makeBundle('ssh-nested', [
      f('/etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\nPasswordAuthentication no\n'),
      f('/etc/ssh/sshd_config.d/10-extra.conf', 'Include /etc/ssh/extra/*.conf\n'),
      f('/etc/ssh/extra/99-hardening.conf', 'PermitRootLogin no\n'),
    ]);
    const model = parseSshd(bundle);
    const root = model.flat.find((n) => n.key === 'PermitRootLogin');
    expect(root?.via).toEqual([
      '/etc/ssh/sshd_config',
      '/etc/ssh/sshd_config.d/10-extra.conf',
      '/etc/ssh/extra/99-hardening.conf',
    ]);
    const eff = sshEffective(model);
    expect(eff.get('permitrootlogin')?.args[0]).toBe('no');
  });

  it('expands includes inside a server block without losing nesting', () => {
    const bundle = makeBundle('loc', [
      f('/etc/nginx/nginx.conf', 'http {\n server {\n  listen 80;\n  include /etc/nginx/conf.d/loc/*.conf;\n }\n}\n'),
      f('/etc/nginx/conf.d/loc/api.conf', 'location /api { proxy_pass http://10.0.0.1; }\n'),
    ]);
    const model = parseNginx(bundle);
    const loc = model.flat.find((n) => n.key === 'location');
    expect(loc?.block).toEqual(['http', 'server']);
    expect(model.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});
