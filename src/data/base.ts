/** Canonical compliant fixture bundles used by the rule sample tests and the
 *  in-app "样例" runner. Each rule's sample patches are applied on top of the
 *  matching base bundle. */
import type { InputFile } from '../engine/types';

export interface BaseBundle {
  name: string;
  files: InputFile[];
}

const SSHD_MAIN = `# OpenSSH server configuration (baseline fixture)
Include /etc/ssh/sshd_config.d/*.conf

Port 22
Protocol 2
PermitRootLogin no
PasswordAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
MaxSessions 10
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
StrictModes yes
PermitUserEnvironment no
UsePAM yes
LogLevel VERBOSE
Banner /etc/ssh/issue.net
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group16-sha512

Match User backup
  PasswordAuthentication yes
`;

const SSHD_DROPIN = `# 50-cloud-init.conf
# intentionally only benign overrides
AcceptEnv LANG LC_*
`;

const SSH_BASE: BaseBundle = {
  name: 'sample-ssh',
  files: [
    { relativePath: '/etc/ssh/sshd_config', content: SSHD_MAIN },
    { relativePath: '/etc/ssh/sshd_config.d/50-cloud-init.conf', content: SSHD_DROPIN },
  ],
};

const NGINX_MAIN = `user nginx;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server_tokens off;
    client_max_body_size 8m;
    client_body_timeout 12s;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    include /etc/nginx/conf.d/*.conf;
}
`;

const NGINX_SITE = `server {
    listen 443 ssl;
    server_name app.example.com;

    ssl_certificate /etc/nginx/certs/app.crt;
    ssl_certificate_key /etc/nginx/certs/app.key;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; frame-ancestors 'self'" always;

    location / {
        autoindex off;
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
    }

    location /static/ {
        autoindex off;
        root /var/www/static;
    }
}
`;

const NGINX_MIME = `types {
    text/html html htm;
    text/css css;
    application/javascript js;
}
`;

const CERT = `-----BEGIN CERTIFICATE-----
MIIBszCCAVmgAwIBAgIUQ2VydGlmaWNhdGVGaXh0dXJlMIIB...fixture...
-----END CERTIFICATE-----
`;

const NGINX_BASE: BaseBundle = {
  name: 'sample-nginx',
  files: [
    { relativePath: '/etc/nginx/nginx.conf', content: NGINX_MAIN },
    { relativePath: '/etc/nginx/mime.types', content: NGINX_MIME },
    { relativePath: '/etc/nginx/conf.d/site.conf', content: NGINX_SITE },
    { relativePath: '/etc/nginx/certs/app.crt', content: CERT },
    { relativePath: '/etc/nginx/certs/app.key', content: CERT.replace('CERTIFICATE', 'PRIVATE KEY') },
  ],
};

const SYSCTL_CONF = `# /etc/sysctl.conf — hardened baseline
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

const SYSCTL_VENDOR = `# vendor defaults loaded before /etc/sysctl.conf
net.ipv4.ip_forward = 1
kernel.sysrq = 1
net.ipv4.tcp_syncookies = 1
`;

const SYSCTL_BASE: BaseBundle = {
  name: 'sample-sysctl',
  files: [
    { relativePath: '/etc/sysctl.conf', content: SYSCTL_CONF },
    { relativePath: '/etc/sysctl.d/10-vendor.conf', content: SYSCTL_VENDOR },
  ],
};

export const BASE_BUNDLES = {
  sshd: SSH_BASE,
  nginx: NGINX_BASE,
  sysctl: SYSCTL_BASE,
} as const;

export type BaseKind = keyof typeof BASE_BUNDLES;
