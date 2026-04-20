# AIClient2API Kiro 增强版 — 原生集成 Changelog

> 基于 v2.13.2.1，将外部 `pre-start-patch.cjs` 的三个修复集成到反代核心代码中。

## 魔改原因

AIClient2API 反向代理搭配 Kiro IDE 使用时存在三个严重问题，导致 Opus 模型不可用、token 过期后无法自动恢复、重启也无法刷新凭证。之前通过外部 `pre-start-patch.cjs` 脚本在启动前临时修复，但每次上游更新都会被覆盖，且无法在运行时自动恢复。

本次修改将所有修复逻辑集成到反代原生代码中，实现**运行时自动恢复**，不再依赖外部脚本。

---

## 修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/providers/claude/claude-kiro.js` | 修复 Opus 上下文溢出 + 运行时 token 自动同步 |
| `src/providers/provider-pool-manager.js` | 新增 `reloadCredentials()` 方法 |
| `src/core/master.js` | 原生凭证同步替代外部 patch 脚本 |

---

## 修复的问题

### 问题 1：Opus 模型上下文溢出

**文件**：`src/providers/claude/claude-kiro.js`

**症状**：使用 Claude Code + Opus 模型时，发送一句 "hi" 后上下文从 12% 飙升到 80%，触发 autocompact thrashing 死循环，Opus 完全不可用。

**根因**：`MODEL_CONTEXT_TOKENS` 中 Opus 模型被设为 1,000,000（1M），但 Claude Code 客户端按 200K 窗口计算。反代用 `contextUsagePercentage × 1M` 算出的 input_tokens 远超客户端预期。

**修改**：将所有 Opus 模型的 `MODEL_CONTEXT_TOKENS` 从 1,000,000 改为 200,000。

```javascript
// 修改前
"claude-opus-4-5-20251101": 1000000,

// 修改后
"claude-opus-4-5-20251101": 200000,
```

**效果**：发送 "hi" 后上下文占用从 80% 降至 16%，autocompact 不再触发。

---

### 问题 2：Kiro token 刷新失败后无法自动恢复

**文件**：`src/providers/claude/claude-kiro.js`

**症状**：Kiro IDE 和反代同时运行时，反代的 refresh token 被 Kiro IDE 抢先使用后失效，反代刷新失败后标记为 unhealthy，所有请求被拒绝，且不会自动恢复。

**根因**：AWS IAM Identity Center 的 refresh token 是一次性的，Kiro IDE 后台持续刷新会导致反代的 refresh token 永远是过期的。

**修改**：

1. **新增 `syncFromKiroIDE()` 函数**（模块级）：
   - 扫描 `~/.aws/sso/cache/` 目录
   - 从 `kiro-auth-token.json` 读取最新的 accessToken/refreshToken
   - 从 hash 文件读取 clientId/clientSecret
   - 合并后写入反代的凭证文件
   - 检查源 token 是否过期，过期则返回 null

2. **修改 `_doTokenRefresh()` 的 catch 块**：
   - refresh 失败后不再直接 throw
   - 先尝试调用 `syncFromKiroIDE()` 从 Kiro IDE 源文件恢复
   - 恢复成功 → 更新内存凭证 + 重置 pool 状态 → 正常返回
   - 恢复也失败 → 才 throw 错误

3. **修改 `loadCredentials()` 末尾**：
   - 加载凭证后检查 expiresAt
   - 如果 token 已过期，自动调用 `syncFromKiroIDE()` 同步
   - 确保启动时就能拿到有效 token

**效果**：反代在运行时 token 过期后自动从 Kiro IDE 恢复，无需重启，无需手动操作。

---

### 问题 3：前端重启按钮不会重新加载凭证

**文件**：`src/core/master.js` + `src/providers/provider-pool-manager.js`

**症状**：前端 Web UI 点击重启按钮后，凭证状态没有刷新，unhealthy 的凭证仍然是 unhealthy。

**根因**：`restartWorker()` 只是 stop + start worker 进程，不会重新从文件加载凭证。

**修改**：

1. **`master.js` — 新增 `syncKiroCredentials()` 函数**：
   - 从 Kiro IDE 源文件同步最新 token 到反代凭证文件
   - 重置 `provider_pools.json` 中的健康状态（isHealthy、errorCount、needsRefresh、refreshCount）
   - 替代外部 `pre-start-patch.cjs` 脚本

2. **`master.js` — 修改 `startWorker()` 和 `restartWorker()`**：
   - 启动/重启 worker 前调用 `syncKiroCredentials()`
   - 移除对外部 `pre-start-patch.cjs` 的依赖

3. **`provider-pool-manager.js` — 新增 `reloadCredentials()` 方法**：
   - 从磁盘重新读取 `provider_pools.json`
   - 重新初始化 provider 状态
   - 触发 warmup

**效果**：点击重启按钮后凭证完全刷新，不需要手动操作。

---

## 自动恢复流程

```
反代 token 过期
    ↓
尝试 refresh token
    ↓
refresh 失败（被 Kiro IDE 抢先使用）
    ↓
自动调用 syncFromKiroIDE()
    ↓
从 ~/.aws/sso/cache/ 读取 Kiro IDE 的最新 token
    ↓
合并 accessToken + refreshToken + clientId + clientSecret
    ↓
更新内存凭证 + 写回文件 + 重置 pool 状态
    ↓
请求继续，用户无感
```

## 前提条件

- Kiro IDE 需要保持运行（或至少最近运行过），以确保源凭证文件中有有效的 token
- Kiro IDE 的 access token 有效期约 1 小时，每 30 分钟自动刷新
- Client registration 有效期约 90 天，过期后需要在 Kiro IDE 中重新授权一次

## 与上游的关系

本分支基于 `justlovemaki/AIClient-2-API` 的 v2.13.2.1 版本。上游更新时需要手动 merge，注意以下文件的冲突：
- `src/providers/claude/claude-kiro.js` — MODEL_CONTEXT_TOKENS 和 _doTokenRefresh/loadCredentials
- `src/core/master.js` — startWorker/restartWorker
- `src/providers/provider-pool-manager.js` — reloadCredentials 方法

`pre-start-patch.cjs` 可以保留作为备用，但正常情况下不再需要。
