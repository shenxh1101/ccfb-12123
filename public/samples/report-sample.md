# 配置基线检查报告

- 报告格式版本：1.0
- 生成工具：Config Baseline Console 1.0.0
- 生成时间：2026-11-24T15:18:44.578Z
- 规则集：主机安全配置基线（SSH / Nginx / 内核参数）（v1，55 条）
- 扫描范围：5 台主机 / 27 个文件 / 8.2 KB
- 耗时：0.01 秒

## 总体结论

综合评分 **67 / 100**，共检查 275 项：通过 160，不通过 64，告警 1，跳过 50。

## 主机汇总

| 主机 | 评分 | 通过 | 不通过 | 告警 | 跳过 | 严重 | 高 | 中 | 低 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| web-01 | 100 | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| db-02 | 25.9 | 9 | 32 | 0 | 14 | 2 | 6 | 15 | 9 |
| gw-03 | 22.6 | 5 | 27 | 1 | 22 | 0 | 6 | 11 | 9 |
| cache-04 | 86.4 | 36 | 5 | 0 | 14 | 0 | 3 | 0 | 2 |
| edge-05 | 100 | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## 严重级别分布（不通过）

| 级别 | 主机数 |
| --- | ---: |
| 严重 | 1 |
| 高 | 3 |
| 中 | 2 |
| 低 | 3 |
| 提示 | 1 |

## 主机：web-01

- 评分：100 / 100
- 结果：通过 55 / 不通过 0 / 告警 0 / 跳过 0
- 配置来源：sshd（2 文件，25 条指令）；nginx（4 文件，40 条指令）；sysctl（1 文件，19 条指令）

全部检查项通过。

### 已通过项

| 规则 | 级别 | 说明 |
| --- | --- | --- |
| SSH-001 禁止 root 直接登录 | 严重 | PermitRootLogin = no，符合要求 |
| SSH-002 禁用密码认证，仅允许公钥 | 严重 | PasswordAuthentication = no，符合要求 |
| SSH-003 禁止空口令登录 | 严重 | PermitEmptyPasswords = no，符合要求 |
| KERN-001 关闭 IPv4 转发 | 高 | net.ipv4.ip_forward = 0，符合要求 |
| KERN-002 拒绝源路由（all） | 高 | net.ipv4.conf.all.accept_source_route = 0，符合要求 |
| KERN-008 开启 SYN Cookie | 高 | net.ipv4.tcp_syncookies = 1，符合要求 |
| KERN-009 开启反向路径过滤（all） | 高 | net.ipv4.conf.all.rp_filter = 1，符合要求 |
| KERN-013 开启地址空间随机化 | 高 | kernel.randomize_va_space = 2，符合要求 |
| NGX-002 仅启用 TLS 1.2 与 TLS 1.3 | 高 | 1 个 server 块的 ssl_protocols 合规 |
| NGX-003 禁用弱 TLS 套件 | 高 | TLS 套件配置合规 |
| NGX-007 配置 HSTS 响应头 | 高 | 1 个 server 块均配置了 Strict-Transport-Security |
| NGX-013 证书文件必须真实存在 | 高 | ssl_certificate 引用的文件均存在 |
| SSH-004 最大认证尝试次数不超过 4 | 高 | MaxAuthTries = 3，满足 <= 4 |
| SSH-013 禁用非安全加密算法 | 高 | Ciphers 未包含禁用算法 |
| SSH-014 禁用弱 MAC 算法 | 高 | MACs 未包含禁用算法 |
| SSH-015 禁用基于 SHA1 的密钥交换 | 高 | KexAlgorithms 未包含禁用算法 |
| KERN-003 拒绝源路由（default） | 中 | net.ipv4.conf.default.accept_source_route = 0，符合要求 |
| KERN-004 拒绝 ICMP 重定向（all） | 中 | net.ipv4.conf.all.accept_redirects = 0，符合要求 |
| KERN-006 不发送 ICMP 重定向 | 中 | net.ipv4.conf.all.send_redirects = 0，符合要求 |
| KERN-010 开启反向路径过滤（default） | 中 | net.ipv4.conf.default.rp_filter = 1，符合要求 |
| KERN-011 隐藏内核符号地址 | 中 | kernel.kptr_restrict = 2，符合要求 |
| KERN-012 限制 dmesg 访问 | 中 | kernel.dmesg_restrict = 1，符合要求 |
| KERN-014 禁用 SysRq 组合键 | 中 | kernel.sysrq = 0，符合要求 |
| KERN-016 启用硬链接保护 | 中 | fs.protected_hardlinks = 1，符合要求 |
| KERN-017 启用符号链接保护 | 中 | fs.protected_symlinks = 1，符合要求 |
| NGX-001 关闭 server_tokens 版本泄露 | 中 | 2 个 server 块的 server_tokens 合规 |
| NGX-008 配置 X-Frame-Options 防点击劫持 | 中 | 1 个 server 块均配置了 X-Frame-Options |
| NGX-009 配置 X-Content-Type-Options | 中 | 1 个 server 块均配置了 X-Content-Type-Options |
| NGX-012 关闭目录自动索引 | 中 | 2 个 location 块配置合规 |
| SSH-005 登录宽限时间不超过 60 秒 | 中 | LoginGraceTime = 30，满足 <= 60 |
| SSH-009 禁用 X11 转发 | 中 | X11Forwarding = no，符合要求 |
| SSH-010 禁用 TCP 转发 | 中 | AllowTcpForwarding = no，符合要求 |
| SSH-011 禁用 SSH 隧道 | 中 | PermitTunnel = no，符合要求 |
| SSH-012 禁用 Agent 转发 | 中 | AllowAgentForwarding = no，符合要求 |
| SSH-018 禁用基于主机的认证 | 中 | HostbasedAuthentication = no，符合要求 |
| SSH-019 忽略 .rhosts 信任文件 | 中 | IgnoreRhosts = yes，符合要求 |
| SSH-020 禁止加载用户环境变量 | 中 | PermitUserEnvironment = no，符合要求 |
| SSH-022 网关端口保持默认关闭 | 中 | GatewayPorts = no，符合要求 |
| KERN-005 拒绝 ICMP 重定向（default） | 低 | net.ipv4.conf.default.accept_redirects = 0，符合要求 |
| KERN-007 记录异常源地址数据包 | 低 | net.ipv4.conf.all.log_martians = 1，符合要求 |
| KERN-015 限制 perf 事件访问 | 低 | kernel.perf_event_paranoid = 3，满足 >= 2 |
| KERN-018 禁用 SUID 进程核心转储 | 低 | fs.suid_dumpable = 0，符合要求 |
| KERN-019 不接受安全 ICMP 重定向 | 低 | net.ipv4.conf.all.secure_redirects = 0，符合要求 |
| NGX-004 优先使用服务端套件顺序 | 低 | 1 个 server 块的 ssl_prefer_server_ciphers 合规 |
| NGX-005 关闭 TLS 会话票据 | 低 | 1 个 server 块的 ssl_session_tickets 合规 |
| NGX-010 配置内容安全策略 CSP | 低 | 1 个 server 块均配置了 Content-Security-Policy |
| NGX-011 配置 Referrer-Policy | 低 | 1 个 server 块均配置了 Referrer-Policy |
| SSH-006 ClientAliveInterval 不超过 300 秒 | 低 | ClientAliveInterval = 300，满足 <= 300 |
| SSH-007 ClientAliveInterval 必须启用 | 低 | ClientAliveInterval = 300，满足 > 0 |
| SSH-008 ClientAliveCountMax 不超过 3 | 低 | ClientAliveCountMax = 3，满足 <= 3 |
| SSH-016 配置登录警告 Banner | 低 | Banner = /etc/ssh/issue.net，符合要求 |
| SSH-017 日志级别为 VERBOSE 或更高 | 低 | LogLevel = VERBOSE，符合要求 |
| SSH-021 限制单连接最大会话数 | 低 | MaxSessions = 10，满足 <= 10 |
| NGX-006 启用 TLS 会话缓存 | 提示 | 1 个 server 块的 ssl_session_cache 合规 |
| NGX-014 conf.d 下不应存在未加载的文件 | 提示 | /etc/nginx/conf.d 下无未加载的配置文件 |

## 主机：db-02

- 评分：25.9 / 100
- 结果：通过 9 / 不通过 32 / 告警 0 / 跳过 14
- 配置来源：sshd（1 文件，13 条指令）；sysctl（2 文件，13 条指令）
- 解析提示：1 条
  - -:0 未发现反向代理配置文件，相关检查项已跳过

### 未通过项

| 规则 | 级别 | 状态 | 说明 | 触发位置 |
| --- | --- | --- | --- | --- |
| SSH-001 禁止 root 直接登录 | 严重 | 不通过 | PermitRootLogin = yes，应为 no | /etc/ssh/sshd_config:4 |
| SSH-002 禁用密码认证，仅允许公钥 | 严重 | 不通过 | PasswordAuthentication = yes，应为 no | /etc/ssh/sshd_config:5 |
| KERN-009 开启反向路径过滤（all） | 高 | 不通过 | net.ipv4.conf.all.rp_filter = 0，应为 1 | /etc/sysctl.conf:7 |
| KERN-013 开启地址空间随机化 | 高 | 不通过 | kernel.randomize_va_space = 1，应为 2 | /etc/sysctl.conf:8 |
| SSH-004 最大认证尝试次数不超过 4 | 高 | 不通过 | MaxAuthTries = 6，不满足 <= 4 | /etc/ssh/sshd_config:7 |
| SSH-013 禁用非安全加密算法 | 高 | 不通过 | Ciphers 包含不安全算法 aes128-cbc, 3des-cbc | /etc/ssh/sshd_config:12 |
| SSH-014 禁用弱 MAC 算法 | 高 | 不通过 | MACs 包含不安全算法 hmac-sha1 | /etc/ssh/sshd_config:13 |
| SSH-015 禁用基于 SHA1 的密钥交换 | 高 | 不通过 | 未显式配置 KexAlgorithms，使用 OpenSSH 默认值 | — |
| KERN-003 拒绝源路由（default） | 中 | 不通过 | 未设置 net.ipv4.conf.default.accept_source_route，未显式加固 | — |
| KERN-010 开启反向路径过滤（default） | 中 | 不通过 | 未设置 net.ipv4.conf.default.rp_filter，未显式加固 | — |
| KERN-011 隐藏内核符号地址 | 中 | 不通过 | 未设置 kernel.kptr_restrict，未显式加固 | — |
| KERN-012 限制 dmesg 访问 | 中 | 不通过 | 未设置 kernel.dmesg_restrict，未显式加固 | — |
| KERN-016 启用硬链接保护 | 中 | 不通过 | fs.protected_hardlinks = 0，应为 1 | /etc/sysctl.conf:10 |
| KERN-017 启用符号链接保护 | 中 | 不通过 | 未设置 fs.protected_symlinks，未显式加固 | — |
| SSH-005 登录宽限时间不超过 60 秒 | 中 | 不通过 | LoginGraceTime = 120，不满足 <= 60 | /etc/ssh/sshd_config:8 |
| SSH-009 禁用 X11 转发 | 中 | 不通过 | X11Forwarding = yes，应为 no | /etc/ssh/sshd_config:10 |
| SSH-010 禁用 TCP 转发 | 中 | 不通过 | AllowTcpForwarding = yes，应为 no | /etc/ssh/sshd_config:11 |
| SSH-011 禁用 SSH 隧道 | 中 | 不通过 | 未显式配置 PermitTunnel，使用 OpenSSH 默认值 | — |
| SSH-012 禁用 Agent 转发 | 中 | 不通过 | 未显式配置 AllowAgentForwarding，使用 OpenSSH 默认值 | — |
| SSH-018 禁用基于主机的认证 | 中 | 不通过 | 未显式配置 HostbasedAuthentication，使用 OpenSSH 默认值 | — |
| SSH-019 忽略 .rhosts 信任文件 | 中 | 不通过 | 未显式配置 IgnoreRhosts，使用 OpenSSH 默认值 | — |
| SSH-020 禁止加载用户环境变量 | 中 | 不通过 | 未显式配置 PermitUserEnvironment，使用 OpenSSH 默认值 | — |
| SSH-022 网关端口保持默认关闭 | 中 | 不通过 | 未显式配置 GatewayPorts，使用 OpenSSH 默认值 | — |
| KERN-005 拒绝 ICMP 重定向（default） | 低 | 不通过 | 未设置 net.ipv4.conf.default.accept_redirects，未显式加固 | — |
| KERN-007 记录异常源地址数据包 | 低 | 不通过 | 未设置 net.ipv4.conf.all.log_martians，未显式加固 | — |
| KERN-015 限制 perf 事件访问 | 低 | 不通过 | 未设置 kernel.perf_event_paranoid | — |
| KERN-018 禁用 SUID 进程核心转储 | 低 | 不通过 | 未设置 fs.suid_dumpable，未显式加固 | — |
| KERN-019 不接受安全 ICMP 重定向 | 低 | 不通过 | 未设置 net.ipv4.conf.all.secure_redirects，未显式加固 | — |
| SSH-007 ClientAliveInterval 必须启用 | 低 | 不通过 | ClientAliveInterval = 0，不满足 > 0 | /etc/ssh/sshd_config:9 |
| SSH-008 ClientAliveCountMax 不超过 3 | 低 | 不通过 | 未配置 ClientAliveCountMax | — |
| SSH-016 配置登录警告 Banner | 低 | 不通过 | 未显式配置 Banner，使用 OpenSSH 默认值 | — |
| SSH-021 限制单连接最大会话数 | 低 | 不通过 | 未配置 MaxSessions | — |

### 整改建议

#### SSH-001 禁止 root 直接登录

- 级别：严重
- 分类：SSH 访问控制
- 当前值：`yes`
- 期望值：`no`
- 修复建议：将 /etc/ssh/sshd_config 中的 PermitRootLogin 设置为 no，改用普通账号登录后 sudo 提权。
- 触发位置：
  - /etc/ssh/sshd_config:4 `PermitRootLogin yes`

#### SSH-002 禁用密码认证，仅允许公钥

- 级别：严重
- 分类：SSH 认证
- 当前值：`yes`
- 期望值：`no`
- 修复建议：设置 PasswordAuthentication no，并确认用户已配置公钥，避免改后锁死登录。
- 触发位置：
  - /etc/ssh/sshd_config:5 `PasswordAuthentication yes`

#### KERN-009 开启反向路径过滤（all）

- 级别：高
- 分类：网络内核
- 当前值：`0`
- 期望值：`1`
- 修复建议：设置 net.ipv4.conf.all.rp_filter = 1，丢弃源地址不可达的伪造报文。
- 触发位置：
  - /etc/sysctl.conf:7 `net.ipv4.conf.all.rp_filter = 0`

#### KERN-013 开启地址空间随机化

- 级别：高
- 分类：内核加固
- 当前值：`1`
- 期望值：`2`
- 修复建议：设置 kernel.randomize_va_space = 2，启用完整的 ASLR。
- 触发位置：
  - /etc/sysctl.conf:8 `kernel.randomize_va_space = 1`

#### SSH-004 最大认证尝试次数不超过 4

- 级别：高
- 分类：SSH 认证
- 当前值：`6`
- 期望值：`<= 4`
- 修复建议：设置 MaxAuthTries 4（或更小），降低口令爆破成功的概率。
- 触发位置：
  - /etc/ssh/sshd_config:7 `MaxAuthTries 6`

#### SSH-013 禁用非安全加密算法

- 级别：高
- 分类：SSH 加密
- 当前值：`aes128-cbc, 3des-cbc, aes256-gcm@openssh.com`
- 期望值：`不包含 3des-cbc, aes128-cbc, aes192-cbc, aes256-cbc, arcfour, arcfour128, arcfour256, blowfish-cbc, cast128-cbc`
- 修复建议：在 Ciphers 中移除 CBC/3DES/RC4/Blowfish 等弱算法，仅保留 chacha20-poly1305 与 AES-GCM。
- 触发位置：
  - /etc/ssh/sshd_config:12 `Ciphers aes128-cbc,3des-cbc,aes256-gcm@openssh.com`

#### SSH-014 禁用弱 MAC 算法

- 级别：高
- 分类：SSH 加密
- 当前值：`hmac-sha1, hmac-sha2-256-etm@openssh.com`
- 期望值：`不包含 hmac-md5, hmac-md5-96, hmac-sha1, hmac-sha1-96, hmac-ripemd160, umac-64@openssh.com`
- 修复建议：在 MACs 中移除 MD5/SHA1/RIPEMD160，保留 ETM 模式的 SHA2 算法。
- 触发位置：
  - /etc/ssh/sshd_config:13 `MACs hmac-sha1,hmac-sha2-256-etm@openssh.com`

#### SSH-015 禁用基于 SHA1 的密钥交换

- 级别：高
- 分类：SSH 加密
- 修复建议：在 KexAlgorithms 中移除 SHA1 系列，保留 curve25519-sha256 与 group16-sha512。

#### KERN-003 拒绝源路由（default）

- 级别：中
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 net.ipv4.conf.default.accept_source_route = 0，使新网卡默认继承安全值。

#### KERN-010 开启反向路径过滤（default）

- 级别：中
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`1`
- 修复建议：设置 net.ipv4.conf.default.rp_filter = 1。

#### KERN-011 隐藏内核符号地址

- 级别：中
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`2`
- 修复建议：设置 kernel.kptr_restrict = 2，普通用户读取 /proc/kallsyms 时显示为 0。

#### KERN-012 限制 dmesg 访问

- 级别：中
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`1`
- 修复建议：设置 kernel.dmesg_restrict = 1，仅 root 可读取内核环形缓冲区。

#### KERN-016 启用硬链接保护

- 级别：中
- 分类：内核加固
- 当前值：`0`
- 期望值：`1`
- 修复建议：设置 fs.protected_hardlinks = 1，防止针对他人文件的硬链接攻击。
- 触发位置：
  - /etc/sysctl.conf:10 `fs.protected_hardlinks = 0`

#### KERN-017 启用符号链接保护

- 级别：中
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`1`
- 修复建议：设置 fs.protected_symlinks = 1，防止 /tmp 下的符号链接攻击。

#### SSH-005 登录宽限时间不超过 60 秒

- 级别：中
- 分类：SSH 认证
- 当前值：`120`
- 期望值：`<= 60`
- 修复建议：设置 LoginGraceTime 30（不超过 60），缩短未认证连接占用时间。
- 触发位置：
  - /etc/ssh/sshd_config:8 `LoginGraceTime 120`

#### SSH-009 禁用 X11 转发

- 级别：中
- 分类：SSH 功能限制
- 当前值：`yes`
- 期望值：`no`
- 修复建议：设置 X11Forwarding no，避免通过 SSH 隧道转发图形界面。
- 触发位置：
  - /etc/ssh/sshd_config:10 `X11Forwarding yes`

#### SSH-010 禁用 TCP 转发

- 级别：中
- 分类：SSH 功能限制
- 当前值：`yes`
- 期望值：`no`
- 修复建议：设置 AllowTcpForwarding no，防止服务器被用作内网跳板。
- 触发位置：
  - /etc/ssh/sshd_config:11 `AllowTcpForwarding yes`

#### SSH-011 禁用 SSH 隧道

- 级别：中
- 分类：SSH 功能限制
- 修复建议：设置 PermitTunnel no，禁止 tun/tap 设备转发。

#### SSH-012 禁用 Agent 转发

- 级别：中
- 分类：SSH 功能限制
- 修复建议：设置 AllowAgentForwarding no，避免攻击者复用已转发的 ssh-agent 凭证。

#### SSH-018 禁用基于主机的认证

- 级别：中
- 分类：SSH 认证
- 修复建议：设置 HostbasedAuthentication no，避免依赖可伪造的主机信任关系。

#### SSH-019 忽略 .rhosts 信任文件

- 级别：中
- 分类：SSH 认证
- 修复建议：设置 IgnoreRhosts yes，禁用基于 ~/.rhosts 与 /etc/hosts.equiv 的信任。

#### SSH-020 禁止加载用户环境变量

- 级别：中
- 分类：SSH 访问控制
- 修复建议：设置 PermitUserEnvironment no，防止用户通过 ~/.ssh/environment 注入变量绕过限制。

#### SSH-022 网关端口保持默认关闭

- 级别：中
- 分类：SSH 功能限制
- 修复建议：设置 GatewayPorts no，避免远程转发端口监听在 0.0.0.0。

#### KERN-005 拒绝 ICMP 重定向（default）

- 级别：低
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 net.ipv4.conf.default.accept_redirects = 0。

#### KERN-007 记录异常源地址数据包

- 级别：低
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`1`
- 修复建议：设置 net.ipv4.conf.all.log_martians = 1，记录不可路由源地址的报文。

#### KERN-015 限制 perf 事件访问

- 级别：低
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`>= 2`
- 修复建议：设置 kernel.perf_event_paranoid >= 2，限制非特权用户使用性能计数器。

#### KERN-018 禁用 SUID 进程核心转储

- 级别：低
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 fs.suid_dumpable = 0，避免 SUID 进程内存被写入 core 文件。

#### KERN-019 不接受安全 ICMP 重定向

- 级别：低
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 net.ipv4.conf.all.secure_redirects = 0。

#### SSH-007 ClientAliveInterval 必须启用

- 级别：低
- 分类：SSH 会话
- 当前值：`0`
- 期望值：`> 0`
- 修复建议：ClientAliveInterval 为 0 表示关闭空闲探测，应设置为非零值（如 300）。
- 触发位置：
  - /etc/ssh/sshd_config:9 `ClientAliveInterval 0`

#### SSH-008 ClientAliveCountMax 不超过 3

- 级别：低
- 分类：SSH 会话
- 当前值：`未配置`
- 期望值：`<= 3`
- 修复建议：设置 ClientAliveCountMax 3，与探测间隔配合在约 15 分钟内断开僵死会话。

#### SSH-016 配置登录警告 Banner

- 级别：低
- 分类：SSH 访问控制
- 修复建议：设置 Banner /etc/ssh/issue.net，在认证前展示经授权的访问声明；Banner none 等于关闭提示。

#### SSH-021 限制单连接最大会话数

- 级别：低
- 分类：SSH 会话
- 当前值：`未配置`
- 期望值：`<= 10`
- 修复建议：设置 MaxSessions 10 或更小，限制复用连接可打开的会话数量。

### 已通过项

| 规则 | 级别 | 说明 |
| --- | --- | --- |
| SSH-003 禁止空口令登录 | 严重 | PermitEmptyPasswords = no，符合要求 |
| KERN-001 关闭 IPv4 转发 | 高 | net.ipv4.ip_forward = 0，符合要求 |
| KERN-002 拒绝源路由（all） | 高 | net.ipv4.conf.all.accept_source_route = 0，符合要求 |
| KERN-008 开启 SYN Cookie | 高 | net.ipv4.tcp_syncookies = 1，符合要求 |
| KERN-004 拒绝 ICMP 重定向（all） | 中 | net.ipv4.conf.all.accept_redirects = 0，符合要求 |
| KERN-006 不发送 ICMP 重定向 | 中 | net.ipv4.conf.all.send_redirects = 0，符合要求 |
| KERN-014 禁用 SysRq 组合键 | 中 | kernel.sysrq = 0，符合要求 |
| SSH-006 ClientAliveInterval 不超过 300 秒 | 低 | ClientAliveInterval = 0，满足 <= 300 |
| SSH-017 日志级别为 VERBOSE 或更高 | 低 | LogLevel = INFO，符合要求 |

### 跳过项

| 规则 | 原因 |
| --- | --- |
| NGX-001 | 未导入反向代理配置 |
| NGX-002 | 未导入反向代理配置 |
| NGX-003 | 未导入反向代理配置 |
| NGX-004 | 未导入反向代理配置 |
| NGX-005 | 未导入反向代理配置 |
| NGX-006 | 未导入反向代理配置 |
| NGX-007 | 未导入反向代理配置 |
| NGX-008 | 未导入反向代理配置 |
| NGX-009 | 未导入反向代理配置 |
| NGX-010 | 未导入反向代理配置 |
| NGX-011 | 未导入反向代理配置 |
| NGX-012 | 未导入反向代理配置 |
| NGX-013 | 未导入反向代理配置 |
| NGX-014 | 未导入反向代理配置 |

## 主机：gw-03

- 评分：22.6 / 100
- 结果：通过 5 / 不通过 27 / 告警 1 / 跳过 22
- 配置来源：nginx（2 文件，17 条指令）；sysctl（1 文件，5 条指令）
- 解析提示：2 条
  - /etc/nginx/nginx.conf:8 include 未匹配到文件：/etc/nginx/mime.types
  - -:0 未发现SSH 守护进程配置文件，相关检查项已跳过

### 未通过项

| 规则 | 级别 | 状态 | 说明 | 触发位置 |
| --- | --- | --- | --- | --- |
| KERN-001 关闭 IPv4 转发 | 高 | 不通过 | net.ipv4.ip_forward = 1，应为 0 | /etc/sysctl.conf:1 |
| KERN-002 拒绝源路由（all） | 高 | 不通过 | 未设置 net.ipv4.conf.all.accept_source_route，未显式加固 | — |
| KERN-009 开启反向路径过滤（all） | 高 | 不通过 | 未设置 net.ipv4.conf.all.rp_filter，未显式加固 | — |
| NGX-002 仅启用 TLS 1.2 与 TLS 1.3 | 高 | 不通过 | gateway.example.com:443 [ssl] ssl_protocols TLSv1 TLSv1.1 TLSv1.2 | /etc/nginx/nginx.conf:10 |
| NGX-003 禁用弱 TLS 套件 | 高 | 不通过 | gateway.example.com:443 [ssl] 含弱套件 RC4-SHA | /etc/nginx/nginx.conf:11 |
| NGX-007 配置 HSTS 响应头 | 高 | 不通过 | gateway.example.com:443 [ssl] 缺少 Strict-Transport-Security | /etc/nginx/conf.d/gateway.conf:1 |
| KERN-003 拒绝源路由（default） | 中 | 不通过 | 未设置 net.ipv4.conf.default.accept_source_route，未显式加固 | — |
| KERN-006 不发送 ICMP 重定向 | 中 | 不通过 | 未设置 net.ipv4.conf.all.send_redirects，未显式加固 | — |
| KERN-010 开启反向路径过滤（default） | 中 | 不通过 | 未设置 net.ipv4.conf.default.rp_filter，未显式加固 | — |
| KERN-011 隐藏内核符号地址 | 中 | 不通过 | kernel.kptr_restrict = 0，应为 2 | /etc/sysctl.conf:3 |
| KERN-012 限制 dmesg 访问 | 中 | 不通过 | 未设置 kernel.dmesg_restrict，未显式加固 | — |
| KERN-014 禁用 SysRq 组合键 | 中 | 不通过 | 未设置 kernel.sysrq，未显式加固 | — |
| KERN-016 启用硬链接保护 | 中 | 不通过 | 未设置 fs.protected_hardlinks，未显式加固 | — |
| KERN-017 启用符号链接保护 | 中 | 不通过 | 未设置 fs.protected_symlinks，未显式加固 | — |
| NGX-001 关闭 server_tokens 版本泄露 | 中 | 不通过 | gateway.example.com:443 [ssl] server_tokens on | /etc/nginx/nginx.conf:9 |
| NGX-008 配置 X-Frame-Options 防点击劫持 | 中 | 不通过 | gateway.example.com:443 [ssl] 缺少 X-Frame-Options | /etc/nginx/conf.d/gateway.conf:1 |
| NGX-012 关闭目录自动索引 | 中 | 不通过 | gateway.example.com:443 [ssl] location / autoindex on | /etc/nginx/conf.d/gateway.conf:11 |
| KERN-005 拒绝 ICMP 重定向（default） | 低 | 不通过 | 未设置 net.ipv4.conf.default.accept_redirects，未显式加固 | — |
| KERN-007 记录异常源地址数据包 | 低 | 不通过 | 未设置 net.ipv4.conf.all.log_martians，未显式加固 | — |
| KERN-015 限制 perf 事件访问 | 低 | 不通过 | 未设置 kernel.perf_event_paranoid | — |
| KERN-018 禁用 SUID 进程核心转储 | 低 | 不通过 | 未设置 fs.suid_dumpable，未显式加固 | — |
| KERN-019 不接受安全 ICMP 重定向 | 低 | 不通过 | 未设置 net.ipv4.conf.all.secure_redirects，未显式加固 | — |
| NGX-004 优先使用服务端套件顺序 | 低 | 不通过 | gateway.example.com:443 [ssl] ssl_prefer_server_ciphers off | /etc/nginx/nginx.conf:12 |
| NGX-005 关闭 TLS 会话票据 | 低 | 不通过 | gateway.example.com:443 [ssl] 未配置 ssl_session_tickets | /etc/nginx/conf.d/gateway.conf:1 |
| NGX-010 配置内容安全策略 CSP | 低 | 不通过 | gateway.example.com:443 [ssl] 缺少 Content-Security-Policy | /etc/nginx/conf.d/gateway.conf:1 |
| NGX-011 配置 Referrer-Policy | 低 | 不通过 | gateway.example.com:443 [ssl] 缺少 Referrer-Policy | /etc/nginx/conf.d/gateway.conf:1 |
| NGX-006 启用 TLS 会话缓存 | 提示 | 不通过 | gateway.example.com:443 [ssl] 未配置 ssl_session_cache | /etc/nginx/conf.d/gateway.conf:1 |
| NGX-014 conf.d 下不应存在未加载的文件 | 提示 | 告警 | /etc/nginx/conf.d 下存在未通过 include 加载的配置文件 | /etc/nginx/conf.d/legacy.conf.disabled:1 |

### 整改建议

#### KERN-001 关闭 IPv4 转发

- 级别：高
- 分类：网络内核
- 当前值：`1`
- 期望值：`0`
- 修复建议：设置 net.ipv4.ip_forward = 0；若主机确需做路由/NAT，应改为通过防火墙策略单独放行。
- 触发位置：
  - /etc/sysctl.conf:1 `net.ipv4.ip_forward = 1`

#### KERN-002 拒绝源路由（all）

- 级别：高
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 net.ipv4.conf.all.accept_source_route = 0，丢弃携带源路由选项的数据包。

#### KERN-009 开启反向路径过滤（all）

- 级别：高
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`1`
- 修复建议：设置 net.ipv4.conf.all.rp_filter = 1，丢弃源地址不可达的伪造报文。

#### NGX-002 仅启用 TLS 1.2 与 TLS 1.3

- 级别：高
- 分类：TLS 配置
- 当前值：`gateway.example.com:443 [ssl]: TLSv1 TLSv1.1 TLSv1.2`
- 期望值：`TLSv1.2 | TLSv1.3`
- 修复建议：设置 ssl_protocols TLSv1.2 TLSv1.3; 并移除 TLSv1/TLSv1.1。
- 触发位置：
  - /etc/nginx/nginx.conf:10 `ssl_protocols TLSv1 TLSv1.1 TLSv1.2;`

#### NGX-003 禁用弱 TLS 套件

- 级别：高
- 分类：TLS 配置
- 当前值：`gateway.example.com:443 [ssl] 含弱套件 RC4-SHA`
- 期望值：`禁用 RC4, 3DES, DES-CBC3, MD5, NULL, EXPORT, aNULL, eNULL, AES128-SHA, AES256-SHA`
- 修复建议：将 ssl_ciphers 收敛为 ECDHE + AEAD 套件，移除 CBC、RC4、3DES 与匿名套件。
- 触发位置：
  - /etc/nginx/nginx.conf:11 `ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA:RC4-SHA;`

#### NGX-007 配置 HSTS 响应头

- 级别：高
- 分类：代理安全头
- 当前值：`gateway.example.com:443 [ssl] 缺少 Strict-Transport-Security`
- 期望值：`Strict-Transport-Security 匹配 /max-age=\d{8,}/`
- 修复建议：在 HTTPS server 块添加 add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
- 触发位置：
  - /etc/nginx/conf.d/gateway.conf:1 `server {`（include 链：/etc/nginx/nginx.conf → /etc/nginx/conf.d/gateway.conf） — server gateway.example.com:443 [ssl]：未添加响应头 Strict-Transport-Security

#### KERN-003 拒绝源路由（default）

- 级别：中
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 net.ipv4.conf.default.accept_source_route = 0，使新网卡默认继承安全值。

#### KERN-006 不发送 ICMP 重定向

- 级别：中
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 net.ipv4.conf.all.send_redirects = 0，避免主机向同网段通告错误路由。

#### KERN-010 开启反向路径过滤（default）

- 级别：中
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`1`
- 修复建议：设置 net.ipv4.conf.default.rp_filter = 1。

#### KERN-011 隐藏内核符号地址

- 级别：中
- 分类：内核加固
- 当前值：`0`
- 期望值：`2`
- 修复建议：设置 kernel.kptr_restrict = 2，普通用户读取 /proc/kallsyms 时显示为 0。
- 触发位置：
  - /etc/sysctl.conf:3 `kernel.kptr_restrict = 0`

#### KERN-012 限制 dmesg 访问

- 级别：中
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`1`
- 修复建议：设置 kernel.dmesg_restrict = 1，仅 root 可读取内核环形缓冲区。

#### KERN-014 禁用 SysRq 组合键

- 级别：中
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 kernel.sysrq = 0，防止控制台按键触发危险的内核操作。

#### KERN-016 启用硬链接保护

- 级别：中
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`1`
- 修复建议：设置 fs.protected_hardlinks = 1，防止针对他人文件的硬链接攻击。

#### KERN-017 启用符号链接保护

- 级别：中
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`1`
- 修复建议：设置 fs.protected_symlinks = 1，防止 /tmp 下的符号链接攻击。

#### NGX-001 关闭 server_tokens 版本泄露

- 级别：中
- 分类：代理指纹
- 当前值：`gateway.example.com:443 [ssl]: on`
- 期望值：`off`
- 修复建议：在 http 或 server 块设置 server_tokens off，隐藏 nginx 版本号。
- 触发位置：
  - /etc/nginx/nginx.conf:9 `server_tokens on;`

#### NGX-008 配置 X-Frame-Options 防点击劫持

- 级别：中
- 分类：代理安全头
- 当前值：`gateway.example.com:443 [ssl] 缺少 X-Frame-Options`
- 期望值：`X-Frame-Options 匹配 /^(SAMEORIGIN|DENY)$/`
- 修复建议：添加 add_header X-Frame-Options "SAMEORIGIN" always;（需要跨域嵌套时改用 DENY + CSP frame-ancestors）。
- 触发位置：
  - /etc/nginx/conf.d/gateway.conf:1 `server {`（include 链：/etc/nginx/nginx.conf → /etc/nginx/conf.d/gateway.conf） — server gateway.example.com:443 [ssl]：未添加响应头 X-Frame-Options

#### NGX-012 关闭目录自动索引

- 级别：中
- 分类：代理访问控制
- 当前值：`gateway.example.com:443 [ssl] location / autoindex on`
- 期望值：`autoindex off`
- 修复建议：在所有 location 中设置 autoindex off，防止目录内容被枚举。
- 触发位置：
  - /etc/nginx/conf.d/gateway.conf:11 `autoindex on;`（include 链：/etc/nginx/nginx.conf → /etc/nginx/conf.d/gateway.conf）

#### KERN-005 拒绝 ICMP 重定向（default）

- 级别：低
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 net.ipv4.conf.default.accept_redirects = 0。

#### KERN-007 记录异常源地址数据包

- 级别：低
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`1`
- 修复建议：设置 net.ipv4.conf.all.log_martians = 1，记录不可路由源地址的报文。

#### KERN-015 限制 perf 事件访问

- 级别：低
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`>= 2`
- 修复建议：设置 kernel.perf_event_paranoid >= 2，限制非特权用户使用性能计数器。

#### KERN-018 禁用 SUID 进程核心转储

- 级别：低
- 分类：内核加固
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 fs.suid_dumpable = 0，避免 SUID 进程内存被写入 core 文件。

#### KERN-019 不接受安全 ICMP 重定向

- 级别：低
- 分类：网络内核
- 当前值：`未设置`
- 期望值：`0`
- 修复建议：设置 net.ipv4.conf.all.secure_redirects = 0。

#### NGX-004 优先使用服务端套件顺序

- 级别：低
- 分类：TLS 配置
- 当前值：`gateway.example.com:443 [ssl]: off`
- 期望值：`on`
- 修复建议：设置 ssl_prefer_server_ciphers on;，由服务端决定协商的套件。
- 触发位置：
  - /etc/nginx/nginx.conf:12 `ssl_prefer_server_ciphers off;`

#### NGX-005 关闭 TLS 会话票据

- 级别：低
- 分类：TLS 配置
- 当前值：`gateway.example.com:443 [ssl]: (未配置)`
- 期望值：`off`
- 修复建议：设置 ssl_session_tickets off;，避免票据密钥泄露导致会话可被解密。
- 触发位置：
  - /etc/nginx/conf.d/gateway.conf:1 `server {`（include 链：/etc/nginx/nginx.conf → /etc/nginx/conf.d/gateway.conf） — server gateway.example.com:443 [ssl]：未配置 ssl_session_tickets

#### NGX-010 配置内容安全策略 CSP

- 级别：低
- 分类：代理安全头
- 当前值：`gateway.example.com:443 [ssl] 缺少 Content-Security-Policy`
- 期望值：`Content-Security-Policy 匹配 /default-src/`
- 修复建议：添加包含 default-src 'self' 与 frame-ancestors 的 Content-Security-Policy。
- 触发位置：
  - /etc/nginx/conf.d/gateway.conf:1 `server {`（include 链：/etc/nginx/nginx.conf → /etc/nginx/conf.d/gateway.conf） — server gateway.example.com:443 [ssl]：未添加响应头 Content-Security-Policy

#### NGX-011 配置 Referrer-Policy

- 级别：低
- 分类：代理安全头
- 当前值：`gateway.example.com:443 [ssl] 缺少 Referrer-Policy`
- 期望值：`Referrer-Policy 匹配 /^(strict-origin-when-cross-origin|no-referrer|strict-origin)$/`
- 修复建议：添加 add_header Referrer-Policy "strict-origin-when-cross-origin" always;，避免泄露完整 URL。
- 触发位置：
  - /etc/nginx/conf.d/gateway.conf:1 `server {`（include 链：/etc/nginx/nginx.conf → /etc/nginx/conf.d/gateway.conf） — server gateway.example.com:443 [ssl]：未添加响应头 Referrer-Policy

#### NGX-006 启用 TLS 会话缓存

- 级别：提示
- 分类：TLS 配置
- 当前值：`gateway.example.com:443 [ssl]: (未配置)`
- 期望值：`shared:`
- 修复建议：设置 ssl_session_cache shared:SSL:10m;，减少 TLS 握手开销并限制内存占用。
- 触发位置：
  - /etc/nginx/conf.d/gateway.conf:1 `server {`（include 链：/etc/nginx/nginx.conf → /etc/nginx/conf.d/gateway.conf） — server gateway.example.com:443 [ssl]：未配置 ssl_session_cache

#### NGX-014 conf.d 下不应存在未加载的文件

- 级别：提示
- 分类：配置整洁度
- 当前值：`/etc/nginx/conf.d/legacy.conf.disabled`
- 期望值：`所有配置文件均被 include 引用`
- 修复建议：将未使用的配置改名备份到 outside 目录或删除，避免运维误判当前生效配置。
- 触发位置：
  - /etc/nginx/conf.d/legacy.conf.disabled:1 `legacy.conf.disabled` — 该文件未被任何 include 指令引用

### 已通过项

| 规则 | 级别 | 说明 |
| --- | --- | --- |
| KERN-008 开启 SYN Cookie | 高 | net.ipv4.tcp_syncookies = 1，符合要求 |
| KERN-013 开启地址空间随机化 | 高 | kernel.randomize_va_space = 2，符合要求 |
| NGX-013 证书文件必须真实存在 | 高 | ssl_certificate 引用的文件均存在 |
| KERN-004 拒绝 ICMP 重定向（all） | 中 | net.ipv4.conf.all.accept_redirects = 0，符合要求 |
| NGX-009 配置 X-Content-Type-Options | 中 | 1 个 server 块均配置了 X-Content-Type-Options |

### 跳过项

| 规则 | 原因 |
| --- | --- |
| SSH-001 | 未导入SSH 守护进程配置 |
| SSH-002 | 未导入SSH 守护进程配置 |
| SSH-003 | 未导入SSH 守护进程配置 |
| SSH-004 | 未导入SSH 守护进程配置 |
| SSH-005 | 未导入SSH 守护进程配置 |
| SSH-006 | 未导入SSH 守护进程配置 |
| SSH-007 | 未导入SSH 守护进程配置 |
| SSH-008 | 未导入SSH 守护进程配置 |
| SSH-009 | 未导入SSH 守护进程配置 |
| SSH-010 | 未导入SSH 守护进程配置 |
| SSH-011 | 未导入SSH 守护进程配置 |
| SSH-012 | 未导入SSH 守护进程配置 |
| SSH-013 | 未导入SSH 守护进程配置 |
| SSH-014 | 未导入SSH 守护进程配置 |
| SSH-015 | 未导入SSH 守护进程配置 |
| SSH-016 | 未导入SSH 守护进程配置 |
| SSH-017 | 未导入SSH 守护进程配置 |
| SSH-018 | 未导入SSH 守护进程配置 |
| SSH-019 | 未导入SSH 守护进程配置 |
| SSH-020 | 未导入SSH 守护进程配置 |
| SSH-021 | 未导入SSH 守护进程配置 |
| SSH-022 | 未导入SSH 守护进程配置 |

## 主机：cache-04

- 评分：86.4 / 100
- 结果：通过 36 / 不通过 5 / 告警 0 / 跳过 14
- 配置来源：sshd（2 文件，19 条指令）；sysctl（1 文件，19 条指令）
- 解析提示：1 条
  - -:0 未发现反向代理配置文件，相关检查项已跳过

### 未通过项

| 规则 | 级别 | 状态 | 说明 | 触发位置 |
| --- | --- | --- | --- | --- |
| SSH-013 禁用非安全加密算法 | 高 | 不通过 | 未显式配置 Ciphers，使用 OpenSSH 默认值 | — |
| SSH-014 禁用弱 MAC 算法 | 高 | 不通过 | 未显式配置 MACs，使用 OpenSSH 默认值 | — |
| SSH-015 禁用基于 SHA1 的密钥交换 | 高 | 不通过 | 未显式配置 KexAlgorithms，使用 OpenSSH 默认值 | — |
| SSH-016 配置登录警告 Banner | 低 | 不通过 | Banner = none，应为 ^(?!(none\|NONE)$).+ | /etc/ssh/sshd_config.d/99-tuning.conf:1 |
| SSH-021 限制单连接最大会话数 | 低 | 不通过 | MaxSessions = 40，不满足 <= 10 | /etc/ssh/sshd_config.d/99-tuning.conf:2 |

### 整改建议

#### SSH-013 禁用非安全加密算法

- 级别：高
- 分类：SSH 加密
- 修复建议：在 Ciphers 中移除 CBC/3DES/RC4/Blowfish 等弱算法，仅保留 chacha20-poly1305 与 AES-GCM。

#### SSH-014 禁用弱 MAC 算法

- 级别：高
- 分类：SSH 加密
- 修复建议：在 MACs 中移除 MD5/SHA1/RIPEMD160，保留 ETM 模式的 SHA2 算法。

#### SSH-015 禁用基于 SHA1 的密钥交换

- 级别：高
- 分类：SSH 加密
- 修复建议：在 KexAlgorithms 中移除 SHA1 系列，保留 curve25519-sha256 与 group16-sha512。

#### SSH-016 配置登录警告 Banner

- 级别：低
- 分类：SSH 访问控制
- 当前值：`none`
- 期望值：`^(?!(none|NONE)$).+`
- 修复建议：设置 Banner /etc/ssh/issue.net，在认证前展示经授权的访问声明；Banner none 等于关闭提示。
- 触发位置：
  - /etc/ssh/sshd_config.d/99-tuning.conf:1 `Banner none`（include 链：/etc/ssh/sshd_config → /etc/ssh/sshd_config.d/99-tuning.conf）

#### SSH-021 限制单连接最大会话数

- 级别：低
- 分类：SSH 会话
- 当前值：`40`
- 期望值：`<= 10`
- 修复建议：设置 MaxSessions 10 或更小，限制复用连接可打开的会话数量。
- 触发位置：
  - /etc/ssh/sshd_config.d/99-tuning.conf:2 `MaxSessions 40`（include 链：/etc/ssh/sshd_config → /etc/ssh/sshd_config.d/99-tuning.conf）

### 已通过项

| 规则 | 级别 | 说明 |
| --- | --- | --- |
| SSH-001 禁止 root 直接登录 | 严重 | PermitRootLogin = no，符合要求 |
| SSH-002 禁用密码认证，仅允许公钥 | 严重 | PasswordAuthentication = no，符合要求 |
| SSH-003 禁止空口令登录 | 严重 | PermitEmptyPasswords = no，符合要求 |
| KERN-001 关闭 IPv4 转发 | 高 | net.ipv4.ip_forward = 0，符合要求 |
| KERN-002 拒绝源路由（all） | 高 | net.ipv4.conf.all.accept_source_route = 0，符合要求 |
| KERN-008 开启 SYN Cookie | 高 | net.ipv4.tcp_syncookies = 1，符合要求 |
| KERN-009 开启反向路径过滤（all） | 高 | net.ipv4.conf.all.rp_filter = 1，符合要求 |
| KERN-013 开启地址空间随机化 | 高 | kernel.randomize_va_space = 2，符合要求 |
| SSH-004 最大认证尝试次数不超过 4 | 高 | MaxAuthTries = 4，满足 <= 4 |
| KERN-003 拒绝源路由（default） | 中 | net.ipv4.conf.default.accept_source_route = 0，符合要求 |
| KERN-004 拒绝 ICMP 重定向（all） | 中 | net.ipv4.conf.all.accept_redirects = 0，符合要求 |
| KERN-006 不发送 ICMP 重定向 | 中 | net.ipv4.conf.all.send_redirects = 0，符合要求 |
| KERN-010 开启反向路径过滤（default） | 中 | net.ipv4.conf.default.rp_filter = 1，符合要求 |
| KERN-011 隐藏内核符号地址 | 中 | kernel.kptr_restrict = 2，符合要求 |
| KERN-012 限制 dmesg 访问 | 中 | kernel.dmesg_restrict = 1，符合要求 |
| KERN-014 禁用 SysRq 组合键 | 中 | kernel.sysrq = 0，符合要求 |
| KERN-016 启用硬链接保护 | 中 | fs.protected_hardlinks = 1，符合要求 |
| KERN-017 启用符号链接保护 | 中 | fs.protected_symlinks = 1，符合要求 |
| SSH-005 登录宽限时间不超过 60 秒 | 中 | LoginGraceTime = 60，满足 <= 60 |
| SSH-009 禁用 X11 转发 | 中 | X11Forwarding = no，符合要求 |
| SSH-010 禁用 TCP 转发 | 中 | AllowTcpForwarding = no，符合要求 |
| SSH-011 禁用 SSH 隧道 | 中 | PermitTunnel = no，符合要求 |
| SSH-012 禁用 Agent 转发 | 中 | AllowAgentForwarding = no，符合要求 |
| SSH-018 禁用基于主机的认证 | 中 | HostbasedAuthentication = no，符合要求 |
| SSH-019 忽略 .rhosts 信任文件 | 中 | IgnoreRhosts = yes，符合要求 |
| SSH-020 禁止加载用户环境变量 | 中 | PermitUserEnvironment = no，符合要求 |
| SSH-022 网关端口保持默认关闭 | 中 | GatewayPorts = no，符合要求 |
| KERN-005 拒绝 ICMP 重定向（default） | 低 | net.ipv4.conf.default.accept_redirects = 0，符合要求 |
| KERN-007 记录异常源地址数据包 | 低 | net.ipv4.conf.all.log_martians = 1，符合要求 |
| KERN-015 限制 perf 事件访问 | 低 | kernel.perf_event_paranoid = 3，满足 >= 2 |
| KERN-018 禁用 SUID 进程核心转储 | 低 | fs.suid_dumpable = 0，符合要求 |
| KERN-019 不接受安全 ICMP 重定向 | 低 | net.ipv4.conf.all.secure_redirects = 0，符合要求 |
| SSH-006 ClientAliveInterval 不超过 300 秒 | 低 | ClientAliveInterval = 300，满足 <= 300 |
| SSH-007 ClientAliveInterval 必须启用 | 低 | ClientAliveInterval = 300，满足 > 0 |
| SSH-008 ClientAliveCountMax 不超过 3 | 低 | ClientAliveCountMax = 3，满足 <= 3 |
| SSH-017 日志级别为 VERBOSE 或更高 | 低 | LogLevel = VERBOSE，符合要求 |

### 跳过项

| 规则 | 原因 |
| --- | --- |
| NGX-001 | 未导入反向代理配置 |
| NGX-002 | 未导入反向代理配置 |
| NGX-003 | 未导入反向代理配置 |
| NGX-004 | 未导入反向代理配置 |
| NGX-005 | 未导入反向代理配置 |
| NGX-006 | 未导入反向代理配置 |
| NGX-007 | 未导入反向代理配置 |
| NGX-008 | 未导入反向代理配置 |
| NGX-009 | 未导入反向代理配置 |
| NGX-010 | 未导入反向代理配置 |
| NGX-011 | 未导入反向代理配置 |
| NGX-012 | 未导入反向代理配置 |
| NGX-013 | 未导入反向代理配置 |
| NGX-014 | 未导入反向代理配置 |

## 主机：edge-05

- 评分：100 / 100
- 结果：通过 55 / 不通过 0 / 告警 0 / 跳过 0
- 配置来源：sshd（1 文件，24 条指令）；nginx（2 文件，23 条指令）；sysctl（1 文件，19 条指令）

全部检查项通过。

### 已通过项

| 规则 | 级别 | 说明 |
| --- | --- | --- |
| SSH-001 禁止 root 直接登录 | 严重 | PermitRootLogin = no，符合要求 |
| SSH-002 禁用密码认证，仅允许公钥 | 严重 | PasswordAuthentication = no，符合要求 |
| SSH-003 禁止空口令登录 | 严重 | PermitEmptyPasswords = no，符合要求 |
| KERN-001 关闭 IPv4 转发 | 高 | net.ipv4.ip_forward = 0，符合要求 |
| KERN-002 拒绝源路由（all） | 高 | net.ipv4.conf.all.accept_source_route = 0，符合要求 |
| KERN-008 开启 SYN Cookie | 高 | net.ipv4.tcp_syncookies = 1，符合要求 |
| KERN-009 开启反向路径过滤（all） | 高 | net.ipv4.conf.all.rp_filter = 1，符合要求 |
| KERN-013 开启地址空间随机化 | 高 | kernel.randomize_va_space = 2，符合要求 |
| NGX-002 仅启用 TLS 1.2 与 TLS 1.3 | 高 | 1 个 server 块的 ssl_protocols 合规 |
| NGX-003 禁用弱 TLS 套件 | 高 | TLS 套件配置合规 |
| NGX-007 配置 HSTS 响应头 | 高 | 1 个 server 块均配置了 Strict-Transport-Security |
| NGX-013 证书文件必须真实存在 | 高 | ssl_certificate 引用的文件均存在 |
| SSH-004 最大认证尝试次数不超过 4 | 高 | MaxAuthTries = 2，满足 <= 4 |
| SSH-013 禁用非安全加密算法 | 高 | Ciphers 未包含禁用算法 |
| SSH-014 禁用弱 MAC 算法 | 高 | MACs 未包含禁用算法 |
| SSH-015 禁用基于 SHA1 的密钥交换 | 高 | KexAlgorithms 未包含禁用算法 |
| KERN-003 拒绝源路由（default） | 中 | net.ipv4.conf.default.accept_source_route = 0，符合要求 |
| KERN-004 拒绝 ICMP 重定向（all） | 中 | net.ipv4.conf.all.accept_redirects = 0，符合要求 |
| KERN-006 不发送 ICMP 重定向 | 中 | net.ipv4.conf.all.send_redirects = 0，符合要求 |
| KERN-010 开启反向路径过滤（default） | 中 | net.ipv4.conf.default.rp_filter = 1，符合要求 |
| KERN-011 隐藏内核符号地址 | 中 | kernel.kptr_restrict = 2，符合要求 |
| KERN-012 限制 dmesg 访问 | 中 | kernel.dmesg_restrict = 1，符合要求 |
| KERN-014 禁用 SysRq 组合键 | 中 | kernel.sysrq = 0，符合要求 |
| KERN-016 启用硬链接保护 | 中 | fs.protected_hardlinks = 1，符合要求 |
| KERN-017 启用符号链接保护 | 中 | fs.protected_symlinks = 1，符合要求 |
| NGX-001 关闭 server_tokens 版本泄露 | 中 | 1 个 server 块的 server_tokens 合规 |
| NGX-008 配置 X-Frame-Options 防点击劫持 | 中 | 1 个 server 块均配置了 X-Frame-Options |
| NGX-009 配置 X-Content-Type-Options | 中 | 1 个 server 块均配置了 X-Content-Type-Options |
| NGX-012 关闭目录自动索引 | 中 | 1 个 location 块配置合规 |
| SSH-005 登录宽限时间不超过 60 秒 | 中 | LoginGraceTime = 20，满足 <= 60 |
| SSH-009 禁用 X11 转发 | 中 | X11Forwarding = no，符合要求 |
| SSH-010 禁用 TCP 转发 | 中 | AllowTcpForwarding = no，符合要求 |
| SSH-011 禁用 SSH 隧道 | 中 | PermitTunnel = no，符合要求 |
| SSH-012 禁用 Agent 转发 | 中 | AllowAgentForwarding = no，符合要求 |
| SSH-018 禁用基于主机的认证 | 中 | HostbasedAuthentication = no，符合要求 |
| SSH-019 忽略 .rhosts 信任文件 | 中 | IgnoreRhosts = yes，符合要求 |
| SSH-020 禁止加载用户环境变量 | 中 | PermitUserEnvironment = no，符合要求 |
| SSH-022 网关端口保持默认关闭 | 中 | GatewayPorts = no，符合要求 |
| KERN-005 拒绝 ICMP 重定向（default） | 低 | net.ipv4.conf.default.accept_redirects = 0，符合要求 |
| KERN-007 记录异常源地址数据包 | 低 | net.ipv4.conf.all.log_martians = 1，符合要求 |
| KERN-015 限制 perf 事件访问 | 低 | kernel.perf_event_paranoid = 2，满足 >= 2 |
| KERN-018 禁用 SUID 进程核心转储 | 低 | fs.suid_dumpable = 0，符合要求 |
| KERN-019 不接受安全 ICMP 重定向 | 低 | net.ipv4.conf.all.secure_redirects = 0，符合要求 |
| NGX-004 优先使用服务端套件顺序 | 低 | 1 个 server 块的 ssl_prefer_server_ciphers 合规 |
| NGX-005 关闭 TLS 会话票据 | 低 | 1 个 server 块的 ssl_session_tickets 合规 |
| NGX-010 配置内容安全策略 CSP | 低 | 1 个 server 块均配置了 Content-Security-Policy |
| NGX-011 配置 Referrer-Policy | 低 | 1 个 server 块均配置了 Referrer-Policy |
| SSH-006 ClientAliveInterval 不超过 300 秒 | 低 | ClientAliveInterval = 120，满足 <= 300 |
| SSH-007 ClientAliveInterval 必须启用 | 低 | ClientAliveInterval = 120，满足 > 0 |
| SSH-008 ClientAliveCountMax 不超过 3 | 低 | ClientAliveCountMax = 2，满足 <= 3 |
| SSH-016 配置登录警告 Banner | 低 | Banner = /etc/ssh/issue.net，符合要求 |
| SSH-017 日志级别为 VERBOSE 或更高 | 低 | LogLevel = VERBOSE，符合要求 |
| SSH-021 限制单连接最大会话数 | 低 | MaxSessions = 8，满足 <= 10 |
| NGX-006 启用 TLS 会话缓存 | 提示 | 1 个 server 块的 ssl_session_cache 合规 |
| NGX-014 conf.d 下不应存在未加载的文件 | 提示 | /etc/nginx/conf.d 下无未加载的配置文件 |

## 附录：检查项定义

| 规则 | 名称 | 分类 | 级别 |
| --- | --- | --- | --- |
| KERN-001 | 关闭 IPv4 转发 | 网络内核 | 高 |
| KERN-002 | 拒绝源路由（all） | 网络内核 | 高 |
| KERN-003 | 拒绝源路由（default） | 网络内核 | 中 |
| KERN-004 | 拒绝 ICMP 重定向（all） | 网络内核 | 中 |
| KERN-005 | 拒绝 ICMP 重定向（default） | 网络内核 | 低 |
| KERN-006 | 不发送 ICMP 重定向 | 网络内核 | 中 |
| KERN-007 | 记录异常源地址数据包 | 网络内核 | 低 |
| KERN-008 | 开启 SYN Cookie | 网络内核 | 高 |
| KERN-009 | 开启反向路径过滤（all） | 网络内核 | 高 |
| KERN-010 | 开启反向路径过滤（default） | 网络内核 | 中 |
| KERN-011 | 隐藏内核符号地址 | 内核加固 | 中 |
| KERN-012 | 限制 dmesg 访问 | 内核加固 | 中 |
| KERN-013 | 开启地址空间随机化 | 内核加固 | 高 |
| KERN-014 | 禁用 SysRq 组合键 | 内核加固 | 中 |
| KERN-015 | 限制 perf 事件访问 | 内核加固 | 低 |
| KERN-016 | 启用硬链接保护 | 内核加固 | 中 |
| KERN-017 | 启用符号链接保护 | 内核加固 | 中 |
| KERN-018 | 禁用 SUID 进程核心转储 | 内核加固 | 低 |
| KERN-019 | 不接受安全 ICMP 重定向 | 网络内核 | 低 |
| NGX-001 | 关闭 server_tokens 版本泄露 | 代理指纹 | 中 |
| NGX-002 | 仅启用 TLS 1.2 与 TLS 1.3 | TLS 配置 | 高 |
| NGX-003 | 禁用弱 TLS 套件 | TLS 配置 | 高 |
| NGX-004 | 优先使用服务端套件顺序 | TLS 配置 | 低 |
| NGX-005 | 关闭 TLS 会话票据 | TLS 配置 | 低 |
| NGX-006 | 启用 TLS 会话缓存 | TLS 配置 | 提示 |
| NGX-007 | 配置 HSTS 响应头 | 代理安全头 | 高 |
| NGX-008 | 配置 X-Frame-Options 防点击劫持 | 代理安全头 | 中 |
| NGX-009 | 配置 X-Content-Type-Options | 代理安全头 | 中 |
| NGX-010 | 配置内容安全策略 CSP | 代理安全头 | 低 |
| NGX-011 | 配置 Referrer-Policy | 代理安全头 | 低 |
| NGX-012 | 关闭目录自动索引 | 代理访问控制 | 中 |
| NGX-013 | 证书文件必须真实存在 | TLS 配置 | 高 |
| NGX-014 | conf.d 下不应存在未加载的文件 | 配置整洁度 | 提示 |
| SSH-001 | 禁止 root 直接登录 | SSH 访问控制 | 严重 |
| SSH-002 | 禁用密码认证，仅允许公钥 | SSH 认证 | 严重 |
| SSH-003 | 禁止空口令登录 | SSH 认证 | 严重 |
| SSH-004 | 最大认证尝试次数不超过 4 | SSH 认证 | 高 |
| SSH-005 | 登录宽限时间不超过 60 秒 | SSH 认证 | 中 |
| SSH-006 | ClientAliveInterval 不超过 300 秒 | SSH 会话 | 低 |
| SSH-007 | ClientAliveInterval 必须启用 | SSH 会话 | 低 |
| SSH-008 | ClientAliveCountMax 不超过 3 | SSH 会话 | 低 |
| SSH-009 | 禁用 X11 转发 | SSH 功能限制 | 中 |
| SSH-010 | 禁用 TCP 转发 | SSH 功能限制 | 中 |
| SSH-011 | 禁用 SSH 隧道 | SSH 功能限制 | 中 |
| SSH-012 | 禁用 Agent 转发 | SSH 功能限制 | 中 |
| SSH-013 | 禁用非安全加密算法 | SSH 加密 | 高 |
| SSH-014 | 禁用弱 MAC 算法 | SSH 加密 | 高 |
| SSH-015 | 禁用基于 SHA1 的密钥交换 | SSH 加密 | 高 |
| SSH-016 | 配置登录警告 Banner | SSH 访问控制 | 低 |
| SSH-017 | 日志级别为 VERBOSE 或更高 | SSH 审计 | 低 |
| SSH-018 | 禁用基于主机的认证 | SSH 认证 | 中 |
| SSH-019 | 忽略 .rhosts 信任文件 | SSH 认证 | 中 |
| SSH-020 | 禁止加载用户环境变量 | SSH 访问控制 | 中 |
| SSH-021 | 限制单连接最大会话数 | SSH 会话 | 低 |
| SSH-022 | 网关端口保持默认关闭 | SSH 功能限制 | 中 |

## 附录：修复后配置预览

### db-02 · /etc/ssh/sshd_config

```diff
  # db-02 /etc/ssh/sshd_config
  Protocol 2
  Port 2222
- PermitRootLogin yes
- PasswordAuthentication yes
+ PermitRootLogin no
+ PasswordAuthentication no
  PermitEmptyPasswords no
- MaxAuthTries 6
- LoginGraceTime 120
- ClientAliveInterval 0
- X11Forwarding yes
- AllowTcpForwarding yes
- Ciphers aes128-cbc,3des-cbc,aes256-gcm@openssh.com
- MACs hmac-sha1,hmac-sha2-256-etm@openssh.com
+ MaxAuthTries 4
+ LoginGraceTime 30
+ ClientAliveInterval 300
+ X11Forwarding no
+ AllowTcpForwarding no
+ Ciphers aes256-gcm@openssh.com
+ MACs hmac-sha2-256-etm@openssh.com
  LogLevel INFO
+ ClientAliveCountMax 3
+ PermitTunnel no
+ AllowAgentForwarding no
+ Banner /etc/ssh/issue.net
+ HostbasedAuthentication no
+ IgnoreRhosts yes
+ PermitUserEnvironment no
+ MaxSessions 10
+ GatewayPorts no
  
```

### db-02 · /etc/sysctl.conf

```diff
…
  net.ipv4.conf.all.accept_redirects = 0
  net.ipv4.conf.all.send_redirects = 0
  net.ipv4.tcp_syncookies = 1
- net.ipv4.conf.all.rp_filter = 0
- kernel.randomize_va_space = 1
+ net.ipv4.conf.all.rp_filter = 1
+ kernel.randomize_va_space = 2
  kernel.sysrq = 0
- fs.protected_hardlinks = 0
+ fs.protected_hardlinks = 1
  
```

### db-02 · /etc/sysctl.d/10-vendor.conf

```diff
…
  kernel.sysrq = 1
  net.ipv4.tcp_syncookies = 1
  vm.swappiness = 10
+ net.ipv4.conf.default.accept_source_route = 0
+ net.ipv4.conf.default.accept_redirects = 0
+ net.ipv4.conf.all.log_martians = 1
+ net.ipv4.conf.default.rp_filter = 1
+ kernel.kptr_restrict = 2
+ kernel.dmesg_restrict = 1
+ kernel.perf_event_paranoid = 2
+ fs.protected_symlinks = 1
+ fs.suid_dumpable = 0
+ net.ipv4.conf.all.secure_redirects = 0
  
```

### gw-03 · /etc/nginx/conf.d/gateway.conf

```diff
…
      add_header X-Content-Type-Options "nosniff" always;
  
      location / {
-         autoindex on;
+         autoindex off;
          proxy_pass http://10.0.0.10:9000;
      }
+     ssl_session_tickets off;
+     ssl_session_cache shared:SSL:10m;
+     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
+     add_header X-Frame-Options SAMEORIGIN always;
+     add_header Content-Security-Policy "default-src 'self'; frame-ancestors 'self'" always;
+     add_header Referrer-Policy strict-origin-when-cross-origin always;
  }
  
```

### gw-03 · /etc/nginx/nginx.conf

```diff
…
  
  http {
      include /etc/nginx/mime.types;
-     server_tokens on;
-     ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
-     ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA:RC4-SHA;
-     ssl_prefer_server_ciphers off;
+     server_tokens off;
+     ssl_protocols TLSv1.2 TLSv1.3;
+     ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
+     ssl_prefer_server_ciphers on;
  
      include /etc/nginx/conf.d/*.conf;
  }
…
```

### gw-03 · /etc/sysctl.conf

```diff
- net.ipv4.ip_forward = 1
+ net.ipv4.ip_forward = 0
  net.ipv4.tcp_syncookies = 1
- kernel.kptr_restrict = 0
+ kernel.kptr_restrict = 2
  kernel.randomize_va_space = 2
  net.ipv4.conf.all.accept_redirects = 0
+ net.ipv4.conf.all.accept_source_route = 0
+ net.ipv4.conf.default.accept_source_route = 0
+ net.ipv4.conf.default.accept_redirects = 0
+ net.ipv4.conf.all.send_redirects = 0
+ net.ipv4.conf.all.log_martians = 1
+ net.ipv4.conf.all.rp_filter = 1
+ net.ipv4.conf.default.rp_filter = 1
+ kernel.dmesg_restrict = 1
+ kernel.sysrq = 0
+ kernel.perf_event_paranoid = 2
+ fs.protected_hardlinks = 1
+ fs.protected_symlinks = 1
+ fs.suid_dumpable = 0
+ net.ipv4.conf.all.secure_redirects = 0
  
```

### cache-04 · /etc/ssh/sshd_config.d/99-tuning.conf

```diff
- Banner none
- MaxSessions 40
+ Banner /etc/ssh/issue.net
+ MaxSessions 10
  
```

