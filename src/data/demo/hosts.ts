/** Built-in demo fleet. Each host mixes compliant and non-compliant values so
 *  the console has something to show on first load. */
import type { ConfigKind, InputFile } from '../../engine/types';

export interface DemoHost {
  name: string;
  kinds: ConfigKind[];
  description: string;
  files: InputFile[];
}

const f = (relativePath: string, content: string): InputFile => ({ relativePath, content });

/* ------------------------------------------------------------------ web-01 */
const WEB01_SSHD = `# web-01 /etc/ssh/sshd_config
Include /etc/ssh/sshd_config.d/*.conf

Port 22
PermitRootLogin no
PasswordAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 3
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitTunnel no
GatewayPorts no
IgnoreRhosts yes
HostbasedAuthentication no
PermitUserEnvironment no
UsePAM yes
LogLevel VERBOSE
Banner /etc/ssh/issue.net
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group16-sha512

Match User deploy
  PasswordAuthentication yes
`;

const WEB01_NGINX = `user nginx;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 2048;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server_tokens off;
    client_max_body_size 16m;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    include /etc/nginx/conf.d/*.conf;
}
`;

const WEB01_SITE = `server {
    listen 443 ssl;
    server_name shop.example.com;

    ssl_certificate /etc/nginx/certs/shop.crt;
    ssl_certificate_key /etc/nginx/certs/shop.key;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; frame-ancestors 'self'" always;

    location / {
        autoindex off;
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /assets/ {
        autoindex off;
        root /var/www/assets;
        expires 7d;
    }
}
`;

const WEB01_GATEWAY = `server {
    listen 80;
    server_name shop.example.com;
    return 301 https://$host$request_uri;
}
`;

const WEB01_SYSCTL = `net.ipv4.ip_forward = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.randomize_va_space = 2
kernel.sysrq = 0
kernel.perf_event_paranoid = 3
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0
net.ipv4.conf.all.secure_redirects = 0
`;

/* ------------------------------------------------------------------ db-02 */
const DB02_SSHD = `# db-02 /etc/ssh/sshd_config
Protocol 2
Port 2222
PermitRootLogin yes
PasswordAuthentication yes
PermitEmptyPasswords no
MaxAuthTries 6
LoginGraceTime 120
ClientAliveInterval 0
X11Forwarding yes
AllowTcpForwarding yes
Ciphers aes128-cbc,3des-cbc,aes256-gcm@openssh.com
MACs hmac-sha1,hmac-sha2-256-etm@openssh.com
LogLevel INFO
`;

const DB02_SYSCTL_D = `# tuned profile applied by the vendor image
net.ipv4.ip_forward = 1
kernel.sysrq = 1
net.ipv4.tcp_syncookies = 1
vm.swappiness = 10
`;

const DB02_SYSCTL = `# /etc/sysctl.conf
net.ipv4.ip_forward = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 0
kernel.randomize_va_space = 1
kernel.sysrq = 0
fs.protected_hardlinks = 0
`;

/* ------------------------------------------------------------------ gw-03 */
const GW03_NGINX = `worker_processes auto;

events {
    worker_connections 4096;
}

http {
    include /etc/nginx/mime.types;
    server_tokens on;
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA:RC4-SHA;
    ssl_prefer_server_ciphers off;

    include /etc/nginx/conf.d/*.conf;
}
`;

const GW03_SITE = `server {
    listen 443 ssl;
    server_name gateway.example.com;

    ssl_certificate /etc/nginx/certs/gw.crt;
    ssl_certificate_key /etc/nginx/certs/gw.key;

    add_header X-Content-Type-Options "nosniff" always;

    location / {
        autoindex on;
        proxy_pass http://10.0.0.10:9000;
    }
}
`;

const GW03_LEGACY = `server {
    listen 443 ssl;
    server_name old.example.com;
    ssl_certificate /etc/nginx/certs/old.crt;
}
`;

const GW03_SYSCTL = `net.ipv4.ip_forward = 1
net.ipv4.tcp_syncookies = 1
kernel.kptr_restrict = 0
kernel.randomize_va_space = 2
net.ipv4.conf.all.accept_redirects = 0
`;

/* ------------------------------------------------------------------ cache-04 */
const CACHE04_SSHD = `Include /etc/ssh/sshd_config.d/*.conf

PermitRootLogin no
PasswordAuthentication no
PermitEmptyPasswords no
MaxAuthTries 4
LoginGraceTime 60
ClientAliveInterval 300
ClientAliveCountMax 3
X11Forwarding no
AllowTcpForwarding no
PermitTunnel no
AllowAgentForwarding no
GatewayPorts no
IgnoreRhosts yes
HostbasedAuthentication no
PermitUserEnvironment no
LogLevel VERBOSE
Banner /etc/ssh/issue.net
`;

const CACHE04_DROPIN = `Banner none
MaxSessions 40
`;

const CACHE04_SYSCTL = `# cache nodes follow the shared hardening profile
net.ipv4.ip_forward = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.randomize_va_space = 2
kernel.sysrq = 0
kernel.perf_event_paranoid = 3
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0
net.ipv4.conf.all.secure_redirects = 0
`;

/* ------------------------------------------------------------------ edge-05 */
const EDGE05_SSHD = `Port 22
Protocol 2
PermitRootLogin no
PasswordAuthentication no
PermitEmptyPasswords no
MaxAuthTries 2
LoginGraceTime 20
ClientAliveInterval 120
ClientAliveCountMax 2
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitTunnel no
GatewayPorts no
IgnoreRhosts yes
HostbasedAuthentication no
PermitUserEnvironment no
UsePAM yes
LogLevel VERBOSE
Banner /etc/ssh/issue.net
MaxSessions 8
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com
KexAlgorithms curve25519-sha256
`;

const EDGE05_NGINX = `worker_processes 2;

events {
    worker_connections 1024;
}

http {
    server_tokens off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_tickets off;
    ssl_session_cache shared:SSL:5m;

    include /etc/nginx/conf.d/*.conf;
}
`;

const EDGE05_SITE = `server {
    listen 443 ssl http2;
    server_name edge.example.com;

    ssl_certificate /etc/nginx/certs/edge.crt;
    ssl_certificate_key /etc/nginx/certs/edge.key;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Content-Security-Policy "default-src 'self'; frame-ancestors 'none'" always;

    location /api/ {
        autoindex off;
        proxy_pass http://10.0.0.20:8080;
    }
}
`;

const EDGE05_SYSCTL = `net.ipv4.ip_forward = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.randomize_va_space = 2
kernel.sysrq = 0
kernel.perf_event_paranoid = 2
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0
net.ipv4.conf.all.secure_redirects = 0
`;

const CERT = (name: string) => `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUZGVtby0${name.padEnd(8, '0')}MA0GCSqGSIb3DQEBCwUA
-----END CERTIFICATE-----
`;

export const DEMO_HOSTS: DemoHost[] = [
  {
    name: 'web-01',
    kinds: ['sshd', 'nginx', 'sysctl'],
    description: '前端应用机 · 合规基线样板',
    files: [
      f('/etc/ssh/sshd_config', WEB01_SSHD),
      f('/etc/ssh/sshd_config.d/60-ops.conf', '# 运维自定义\nMaxSessions 10\n'),
      f('/etc/nginx/nginx.conf', WEB01_NGINX),
      f('/etc/nginx/mime.types', 'types {\n    text/html html;\n    application/javascript js;\n}\n'),
      f('/etc/nginx/conf.d/shop.conf', WEB01_SITE),
      f('/etc/nginx/conf.d/shop-http.conf', WEB01_GATEWAY),
      f('/etc/nginx/certs/shop.crt', CERT('web01')),
      f('/etc/nginx/certs/shop.key', CERT('web01')),
      f('/etc/sysctl.conf', WEB01_SYSCTL),
    ],
  },
  {
    name: 'db-02',
    kinds: ['sshd', 'sysctl'],
    description: '数据库节点 · 存在多项高风险偏差',
    files: [
      f('/etc/ssh/sshd_config', DB02_SSHD),
      f('/etc/sysctl.conf', DB02_SYSCTL),
      f('/etc/sysctl.d/10-vendor.conf', DB02_SYSCTL_D),
    ],
  },
  {
    name: 'gw-03',
    kinds: ['nginx', 'sysctl'],
    description: '边界网关 · TLS 与响应头不合规',
    files: [
      f('/etc/nginx/nginx.conf', GW03_NGINX),
      f('/etc/nginx/conf.d/gateway.conf', GW03_SITE),
      f('/etc/nginx/conf.d/legacy.conf.disabled', GW03_LEGACY),
      f('/etc/nginx/certs/gw.crt', CERT('gw03')),
      f('/etc/nginx/certs/gw.key', CERT('gw03')),
      f('/etc/sysctl.conf', GW03_SYSCTL),
    ],
  },
  {
    name: 'cache-04',
    kinds: ['sshd', 'sysctl'],
    description: '缓存集群成员 · 通过 Include 覆盖了 Banner',
    files: [
      f('/etc/ssh/sshd_config', CACHE04_SSHD),
      f('/etc/ssh/sshd_config.d/99-tuning.conf', CACHE04_DROPIN),
      f('/etc/sysctl.conf', CACHE04_SYSCTL),
    ],
  },
  {
    name: 'edge-05',
    kinds: ['sshd', 'nginx', 'sysctl'],
    description: '边缘节点 · 全部检查项通过',
    files: [
      f('/etc/ssh/sshd_config', EDGE05_SSHD),
      f('/etc/nginx/nginx.conf', EDGE05_NGINX),
      f('/etc/nginx/conf.d/edge.conf', EDGE05_SITE),
      f('/etc/nginx/certs/edge.crt', CERT('edge05')),
      f('/etc/nginx/certs/edge.key', CERT('edge05')),
      f('/etc/sysctl.conf', EDGE05_SYSCTL),
    ],
  },
];

/** A larger synthetic fleet for the performance demo (batch directory import). */
export function makeBulkFleet(count: number): DemoHost[] {
  const hosts: DemoHost[] = [];
  for (let i = 0; i < count; i++) {
    const base = DEMO_HOSTS[i % DEMO_HOSTS.length];
    const n = String(i + 1).padStart(3, '0');
    hosts.push({
      name: `bulk-${n}`,
      kinds: base.kinds,
      description: `批量样例 ${n}`,
      files: base.files.map((file) => ({ ...file })),
    });
  }
  return hosts;
}
