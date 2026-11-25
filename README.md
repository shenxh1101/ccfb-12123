# 基线检查台 · Config Baseline Console

面向运维的**本地化**配置基线检查台：把几百台服务器的 `sshd_config`、Nginx 配置和
`sysctl` 参数拖进浏览器，就能按规则文件逐项检查、定位到具体配置行、生成修复后的配置并
复扫验证，最后导出固定格式的 Markdown / JSON 报告。

所有解析、规则计算、修复生成都在浏览器本地完成（扫描在 Web Worker 里跑），
**不向任何服务器上传配置内容**，也不需要后端。

## 快速开始

```bash
npm install
npm run dev          # http://127.0.0.1:4173
npm run build        # 生产构建到 dist/（纯静态，可直接托管）
```

打开后点「载入演示主机」即可体验完整流程：导入 → 检查项 → 扫描结果 → 整改建议 → 报告导出。

## 功能与需求对照

| 需求 | 实现 |
| --- | --- |
| 配置导入 | 整目录 / 多选文件 / `.zip` 压缩包 / 单段粘贴；按 `主机名/etc/...` 自动分组、路径归一、去重、过滤二进制与超大文件；解析在 Worker 中执行，数百文件不卡界面 |
| SSH / 反向代理 / 内核参数三类配置 | `sshd`（含 `Include` 与 `Match` 块）、`nginx`（`http/server/location` 嵌套与 `include`）、`sysctl`（`sysctl.d` 加载顺序与 `-` 前缀） |
| include 与多级引用展开 | include 就地展开并记录 `via`（引用链）与 `block`（嵌套层级）；检测循环引用与未匹配的 include |
| 规则文件驱动 | `src/data/rules/baseline-rules.json`：声明式 `check` + 严重级别 + 修复建议 + 自动修复模板 + 样例补丁；可在页面上导入自定义规则文件 |
| 规则 ≥ 30 条并各有通过/不通过样例 | 内置 **55 条**（SSH 22 / Nginx 14 / sysctl 19），每条都带 `samples.pass` / `samples.fail`，页面上一键校验全部样例 |
| 结果按主机分组并可定位到行 | 主机卡片 → 规则行 → 证据（文件、行号、原始片段、include 链、所在块），配置视图同步高亮 |
| 整改建议生成修复后配置并复扫 | 按规则生成最小改动（替换/删除/在正确位置插入），输出 diff、完整修复后文件；“应用修复并重扫”给出修复前后评分对比 |
| 报告导出 Markdown + JSON | 固定 schema（`schemaVersion: 1.0`），章节与字段稳定，可选附带修复差异 |

## 页面

- **配置导入**：拖拽/选择目录或 zip，主机清单、导入耗时与忽略文件明细。
- **检查项**：按类型、级别、关键字筛选；查看规则定义（含 YAML 风格表达式）、通过/不通过样例、规则 JSON；可运行单个或全部样例。
- **扫描结果**：综合评分、严重级别分布、按主机分组的结果列表；每条结果都能展开到配置文件的具体行。
- **配置视图**：源文件（与扫描命中行同步高亮）、展开后的指令树、include 引用关系。
- **整改建议**：待修改文件列表、diff / 修复后 / 原始三种视图、可勾选规则重新生成、修复后复扫对比。
- **报告导出**：Markdown / JSON 预览与下载。

## 规则文件格式

```json
{
  "version": 1,
  "name": "我的规则集",
  "rules": [
    {
      "id": "SSH-001",
      "title": "禁止 root 直接登录",
      "kind": "sshd",
      "category": "SSH 访问控制",
      "severity": "critical",
      "reference": "CIS 5.2.8",
      "remediation": "设置 PermitRootLogin no",
      "check": { "type": "sshdValue", "key": "PermitRootLogin", "in": ["no"], "absentMeans": "fail" },
      "fix": { "args": ["no"] },
      "samples": {
        "pass": [],
        "fail": [{ "file": "/etc/ssh/sshd_config", "find": "PermitRootLogin no", "replace": "PermitRootLogin yes" }]
      }
    }
  ]
}
```

支持的检查类型：

- sshd：`sshdValue`、`sshdPresent`、`sshdAbsent`、`sshdNumeric`、`sshdListSubset`、`sshdListExcludes`
- sysctl：`sysctlEquals`、`sysctlNumeric`、`sysctlOneOf`
- nginx：`nginxServerValue`、`nginxServerHeader`、`nginxServerCipher`、`nginxServerFile`、`nginxHttpValue`、`nginxLocationValue`、`nginxOrphanIncludes`
- 组合：`allOf`、`anyOf`、`not`

`absentMeans` 决定指令缺失时算“通过”还是“不通过”；`samples` 里的补丁会在内置基础配置上应用，
因此每条规则都能被自动化验证。

## 语义细节

- **sshd**：多个 `Include` 就地展开，遵循 OpenSSH “首个取到的值生效”；`Match` 块中的值只作为提示证据，不参与全局判定。
- **nginx**：`server` 块内指令按最近祖先继承；仅做 HTTP→HTTPS 跳转的 server 不要求安全响应头；证书类规则会校验文件是否在导入目录中存在。
- **sysctl**：按 `/usr/lib → /usr/local/lib → /run → /etc/sysctl.d → /etc/sysctl.conf` 顺序加载，后加载覆盖先加载；重复设置会在证据里标注。

## 质量保障

```bash
npm test             # 159 个单元/集成测试（解析器、规则样例、整改复扫、报告、导入、性能）
npm run e2e          # 6 个 Playwright 端到端用例（含 120 台批量导入、zip 往返、规则深链）
npm run samples      # 重新生成 public/samples/ 下的样例主机、规则样例与参考报告
```

单元测试包含：55 条规则各自的“通过样例必须通过 / 不通过样例必须不通过”，
以及三条配置类型从「全部打坏 → 生成修复 → 复扫」的闭环。

## 目录结构

```
src/
  engine/            解析、评估、整改、报告（纯函数，无 DOM 依赖）
    parsers/         sshd / nginx / sysctl 解析器
    evaluators/      各类 check 的判定与修复目标推导
  worker/            扫描 Web Worker
  data/rules/        内置规则文件
  data/demo/         演示主机
  ui/                页面与组件
  state/             全局状态与扫描调度
tests/               Vitest 单元测试
e2e/                 Playwright 端到端测试
public/samples/      可下载的样例配置包与参考报告
```

## 数据与隐私

导入的文件只存在于当前标签页内存中，刷新即清空；没有网络请求、没有持久化存储。
