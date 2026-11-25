import type { ConfigFileModel, ConfigNode, RuleCheck, RuleFixSpec } from '../types';
import { basename, dirname, resolveAgainst } from '../paths';
import { evidenceOf, type EvalOutcome, type FixTarget } from './common';

interface ServerBlock {
  node: ConfigNode;
  chain: ConfigNode[];
  ssl: boolean;
  listen: ConfigNode[];
  locations: ConfigNode[];
  /** Only a 3xx `return` and no locations: a plain HTTP→HTTPS redirect vhost. */
  redirectOnly: boolean;
}

function collectServers(model: ConfigFileModel): { httpBlocks: ConfigNode[]; servers: ServerBlock[] } {
  const httpBlocks: ConfigNode[] = [];
  const servers: ServerBlock[] = [];

  const makeServer = (n: ConfigNode, chain: ConfigNode[]): ServerBlock => {
    const children = n.children ?? [];
    const listen = children.filter((c) => c.key === 'listen');
    const locations = children.filter((c) => c.key === 'location');
    const returns = children.filter((c) => c.key === 'return');
    return {
      node: n,
      chain: [...chain, n],
      ssl:
        listen.some((l) => l.args.some((a) => a === 'ssl')) ||
        children.some((c) => c.key === 'ssl_certificate') ||
        listen.some((l) => l.args.some((a) => /(^|:)443$/.test(a))),
      listen,
      locations,
      redirectOnly: locations.length === 0 && returns.some((r) => /^30[12378]$/.test(r.args[0] ?? '')),
    };
  };

  const visit = (nodes: ConfigNode[], chain: ConfigNode[], inHttp: boolean) => {
    for (const n of nodes) {
      if (n.key === 'http' && !inHttp) {
        httpBlocks.push(n);
        visit(n.children ?? [], [...chain, n], true);
        continue;
      }
      if (n.key === 'server' && inHttp) {
        servers.push(makeServer(n, chain));
        visit(n.children ?? [], [...chain, n], true);
        continue;
      }
      if (n.children?.length) visit(n.children, [...chain, n], inHttp);
    }
  };
  visit(model.nodes, [], false);

  if (!httpBlocks.length) {
    for (const n of model.nodes.filter((x) => x.key === 'server')) servers.push(makeServer(n, []));
  }
  return { httpBlocks, servers };
}

/** nginx inheritance: the nearest level that defines the key provides all its
 *  values (directives are not merged across levels). */
function resolveInherited(server: ServerBlock, key: string): ConfigNode[] {
  const fromServer = (server.node.children ?? []).filter((c) => c.key === key);
  if (fromServer.length) return fromServer;
  for (let i = server.chain.length - 2; i >= 0; i--) {
    const found = (server.chain[i].children ?? []).filter((c) => c.key === key);
    if (found.length) return found;
  }
  return [];
}

function serverLabel(s: ServerBlock): string {
  const names = (s.node.children ?? []).filter((c) => c.key === 'server_name').flatMap((c) => c.args);
  const port = s.listen.flatMap((l) => l.args).filter((a) => /^\d+$/.test(a)).join(',');
  return `${names.join(' ') || '(未命名)'}${port ? `:${port}` : ''}${s.ssl ? ' [ssl]' : ''}`;
}

function serverEvidence(s: ServerBlock, note: string) {
  return evidenceOf(s.node, `server ${serverLabel(s)}：${note}`);
}

function inScope(s: ServerBlock, scope: 'all' | 'ssl' | undefined): boolean {
  return scope === 'ssl' ? s.ssl : true;
}

export function evalNginxCheck(check: RuleCheck, model: ConfigFileModel, fix?: RuleFixSpec): EvalOutcome {
  const { httpBlocks, servers } = collectServers(model);

  const targetFor = (s: ServerBlock, key: string, args: string[], existing: ConfigNode[]): FixTarget => {
    if (existing.length) return { key, args, node: existing[0], fallbackFile: existing[0].file };
    return { key, args, anchor: s.node, fallbackFile: s.node.file, note: `在 server ${serverLabel(s)} 块内追加` };
  };

  switch (check.type) {
    case 'nginxServerValue': {
      const scoped = servers.filter((s) => inScope(s, check.scope));
      if (!scoped.length) {
        return { status: 'skip', message: check.scope === 'ssl' ? '未发现 SSL/TLS 虚拟主机' : '未发现 server 块', evidence: [] };
      }
      const evidence: ReturnType<typeof evidenceOf>[] = [];
      const failures: string[] = [];
      const observed: string[] = [];
      const targets: FixTarget[] = [];
      const desired = fix?.args ?? (check.equals !== undefined ? [check.equals] : check.in?.slice(0, 1));
      for (const s of scoped) {
        const nodes = resolveInherited(s, check.key);
        if (!nodes.length) {
          observed.push(`${serverLabel(s)}: (未配置)`);
          if (check.absentMeans === 'pass') continue;
          failures.push(`${serverLabel(s)} 未配置 ${check.key}`);
          evidence.push(serverEvidence(s, `未配置 ${check.key}`));
          if (desired) targets.push(targetFor(s, check.key, desired, []));
          continue;
        }
        const values = nodes.flatMap((n) => n.args);
        observed.push(`${serverLabel(s)}: ${values.join(' ') || '(空)'}`);
        let ok = true;
        if (check.equals !== undefined) ok = values.length === 1 && values[0] === check.equals;
        if (check.in) ok = values.length > 0 && values.every((v) => check.in!.includes(v));
        if (check.subsetOf) ok = values.every((v) => check.subsetOf!.includes(v));
        if (check.matches) {
          try {
            ok = new RegExp(check.matches).test(values[0] ?? '');
          } catch {
            ok = false;
          }
        }
        if (!ok) {
          failures.push(`${serverLabel(s)} ${check.key} ${values.join(' ')}`);
          evidence.push(...nodes.map((n) => evidenceOf(n)));
          if (desired) targets.push(targetFor(s, check.key, desired, nodes));
        }
      }
      return {
        status: failures.length ? 'fail' : 'pass',
        message: failures.length ? failures.join('；') : `${scoped.length} 个 server 块的 ${check.key} 合规`,
        evidence,
        observed: observed.join('；'),
        expected: check.equals ?? check.in?.join(' | ') ?? check.subsetOf?.join(' | ') ?? check.matches,
        targets: failures.length ? targets : undefined,
      };
    }
    case 'nginxServerHeader': {
      const scoped = servers.filter((s) => inScope(s, check.scope) && !s.redirectOnly);
      if (!scoped.length) {
        return servers.length
          ? { status: 'skip', message: '范围内只有 HTTP→HTTPS 跳转 server，无需配置安全响应头', evidence: [] }
          : { status: 'skip', message: '未发现 server 块', evidence: [] };
      }
      const evidence = [];
      const failures: string[] = [];
      const targets: FixTarget[] = [];
      const fixedArgs = fix?.args ?? ['always'];
      for (const s of scoped) {
        const headers = resolveInherited(s, 'add_header');
        const hits = headers.filter((h) => (h.args[0] ?? '').toLowerCase() === check.name.toLowerCase());
        if (!hits.length) {
          failures.push(`${serverLabel(s)} 缺少 ${check.name}`);
          evidence.push(serverEvidence(s, `未添加响应头 ${check.name}`));
          targets.push({ key: 'add_header', args: [check.name, ...fixedArgs], anchor: s.node, fallbackFile: s.node.file });
          continue;
        }
        const bad = hits.filter((h) => {
          if (!check.valueMatches) return false;
          const value = h.args[1] ?? '';
          try {
            return !new RegExp(check.valueMatches).test(value);
          } catch {
            return true;
          }
        });
        if (bad.length) {
          failures.push(`${serverLabel(s)} ${check.name} 取值 ${bad[0].args[1] ?? ''} 不合规`);
          evidence.push(...bad.map((h) => evidenceOf(h)));
          targets.push({ key: 'add_header', args: [check.name, ...fixedArgs], node: bad[0], fallbackFile: bad[0].file });
        }
      }
      return {
        status: failures.length ? 'fail' : 'pass',
        message: failures.length ? failures.join('；') : `${scoped.length} 个 server 块均配置了 ${check.name}`,
        evidence,
        observed: failures.length ? failures.join('；') : '全部配置',
        expected: check.valueMatches ? `${check.name} 匹配 /${check.valueMatches}/` : check.name,
        targets: failures.length ? targets : undefined,
      };
    }
    case 'nginxServerCipher': {
      const scoped = servers.filter((s) => inScope(s, check.scope));
      if (!scoped.length) return { status: 'skip', message: '未发现 SSL/TLS 虚拟主机', evidence: [] };
      const evidence = [];
      const failures: string[] = [];
      const targets: FixTarget[] = [];
      for (const s of scoped) {
        const nodes = resolveInherited(s, check.key);
        if (!nodes.length) {
          failures.push(`${serverLabel(s)} 未配置 ${check.key}`);
          evidence.push(serverEvidence(s, `未配置 ${check.key}`));
          const args = fix?.args?.length ? fix.args : undefined;
          if (args) targets.push(targetFor(s, check.key, args, []));
          continue;
        }
        const ciphers = nodes.flatMap((n) => n.args[0]?.split(':') ?? []).map((c) => c.trim()).filter(Boolean);
        const bad = ciphers.filter((c) => check.forbidden.some((f) => c.toUpperCase().startsWith(f.toUpperCase())));
        const missing = (check.require ?? []).filter((r) => !ciphers.some((c) => c.toUpperCase().includes(r.toUpperCase())));
        if (bad.length || missing.length) {
          const parts: string[] = [];
          if (bad.length) parts.push(`含弱套件 ${bad.join(', ')}`);
          if (missing.length) parts.push(`缺少 ${missing.join(', ')}`);
          failures.push(`${serverLabel(s)} ${parts.join('，')}`);
          evidence.push(...nodes.map((n) => evidenceOf(n)));
          const args = fix?.args?.length ? fix.args : undefined;
          if (args) targets.push(targetFor(s, check.key, args, nodes));
        }
      }
      return {
        status: failures.length ? 'fail' : 'pass',
        message: failures.length ? failures.join('；') : 'TLS 套件配置合规',
        evidence,
        observed: failures.length ? failures.join('；') : '合规',
        expected: `禁用 ${check.forbidden.join(', ')}`,
        targets: failures.length ? targets : undefined,
      };
    }
    case 'nginxServerFile': {
      const scoped = servers.filter((s) => inScope(s, check.scope));
      if (!scoped.length) return { status: 'skip', message: '未发现 SSL/TLS 虚拟主机', evidence: [] };
      const evidence = [];
      const failures: string[] = [];
      const sslRoot = dirname(model.root);
      for (const s of scoped) {
        const nodes = resolveInherited(s, check.key);
        if (!nodes.length) {
          failures.push(`${serverLabel(s)} 未配置 ${check.key}`);
          evidence.push(serverEvidence(s, `未配置 ${check.key}`));
          continue;
        }
        for (const n of nodes) {
          const raw = n.args[0] ?? '';
          if (!raw) {
            failures.push(`${serverLabel(s)} ${check.key} 为空`);
            evidence.push(evidenceOf(n));
            continue;
          }
          const resolved = resolveAgainst(sslRoot, raw);
          if (model.availableFiles.length && !model.availableFiles.includes(resolved)) {
            failures.push(`${serverLabel(s)} 证书文件不存在：${raw}`);
            evidence.push(evidenceOf(n, `解析路径 ${resolved} 在导入的目录中不存在`));
          }
        }
      }
      return {
        status: failures.length ? 'fail' : 'pass',
        message: failures.length ? failures.join('；') : `${check.key} 引用的文件均存在`,
        evidence,
        observed: failures.length ? failures.join('；') : '文件存在',
        expected: `${check.key} 指向真实存在且可读的文件`,
      };
    }
    case 'nginxHttpValue': {
      if (!httpBlocks.length) {
        return {
          status: check.present ? 'fail' : check.absentMeans === 'pass' ? 'pass' : 'fail',
          message: '未发现 http 块',
          evidence: [],
        };
      }
      const evidence = [];
      const failures: string[] = [];
      const observed: string[] = [];
      const targets: FixTarget[] = [];
      const desired = fix?.args ?? (check.equals !== undefined ? [check.equals] : check.in?.slice(0, 1));
      for (const http of httpBlocks) {
        const nodes = (http.children ?? []).filter((n) => n.key === check.key);
        if (!nodes.length) {
          observed.push('(未配置)');
          if (check.present || check.absentMeans !== 'pass') {
            failures.push(`http 块未配置 ${check.key}`);
            evidence.push(evidenceOf(http, `http 块未配置 ${check.key}`));
            if (desired) targets.push({ key: check.key, args: desired, anchor: http, fallbackFile: http.file });
          }
          continue;
        }
        const values = nodes.flatMap((n) => n.args);
        observed.push(values.join(' '));
        let ok = true;
        if (check.equals !== undefined) ok = values.length === 1 && values[0] === check.equals;
        if (check.in) ok = values.length > 0 && values.every((v) => check.in!.includes(v));
        if (!ok) {
          failures.push(`http ${check.key} ${values.join(' ')}`);
          evidence.push(...nodes.map((n) => evidenceOf(n)));
          if (desired) targets.push({ key: check.key, args: desired, node: nodes[0], fallbackFile: nodes[0].file });
        }
      }
      return {
        status: failures.length ? 'fail' : 'pass',
        message: failures.length ? failures.join('；') : `http 级 ${check.key} 合规`,
        evidence,
        observed: observed.join('；'),
        expected: check.present ? `存在 ${check.key}` : (check.equals ?? check.in?.join(' | ')),
        targets: failures.length ? targets : undefined,
      };
    }
    case 'nginxLocationValue': {
      const evidence = [];
      const failures: string[] = [];
      const targets: FixTarget[] = [];
      let count = 0;
      for (const s of servers) {
        for (const loc of s.locations) {
          count++;
          const nodes = (loc.children ?? []).filter((n) => n.key === check.key);
          const effective = nodes.length ? nodes : resolveInherited(s, check.key);
          if (!effective.length) {
            if (check.absentMeans === 'pass') continue;
            failures.push(`${serverLabel(s)} location ${loc.args.join(' ')} 未配置 ${check.key}`);
            evidence.push(evidenceOf(loc, `location ${loc.args.join(' ')} 未配置 ${check.key}`));
            if (check.equals !== undefined) {
              targets.push({ key: check.key, args: [check.equals], anchor: loc, fallbackFile: loc.file });
            }
            continue;
          }
          const values = effective.flatMap((n) => n.args);
          if (check.equals !== undefined && !(values.length === 1 && values[0] === check.equals)) {
            failures.push(`${serverLabel(s)} location ${loc.args.join(' ')} ${check.key} ${values.join(' ')}`);
            evidence.push(...effective.map((n) => evidenceOf(n)));
            targets.push({ key: check.key, args: [check.equals], node: effective[0], fallbackFile: effective[0].file });
          }
        }
      }
      if (!count) return { status: 'skip', message: '未发现 location 块', evidence: [] };
      return {
        status: failures.length ? 'fail' : 'pass',
        message: failures.length ? failures.join('；') : `${count} 个 location 块配置合规`,
        evidence,
        observed: failures.length ? failures.join('；') : '合规',
        expected: check.equals ? `${check.key} ${check.equals}` : check.key,
        targets: failures.length ? targets : undefined,
      };
    }
    case 'nginxOrphanIncludes': {
      const dir = check.dir.replace(/\/$/, '');
      const included = new Set<string>();
      for (const edge of model.includes) for (const m of edge.matched) included.add(m);
      const stray = model.availableFiles.filter(
        (f) => f.startsWith(`${dir}/`) && !included.has(f) && !f.endsWith('mime.types') && !f.endsWith('.default'),
      );
      return {
        status: stray.length ? 'warn' : 'pass',
        message: stray.length ? `${dir} 下存在未通过 include 加载的配置文件` : `${dir} 下无未加载的配置文件`,
        evidence: stray.map((f) => ({ file: f, line: 1, snippet: basename(f), note: '该文件未被任何 include 指令引用' })),
        observed: stray.join(', '),
        expected: '所有配置文件均被 include 引用',
      };
    }
    default:
      throw new Error(`nginx 评估器不支持检查类型 ${check.type}`);
  }
}
