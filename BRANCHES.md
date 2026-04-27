# 分支说明

> Fork 自 [justlovemaki/AIClient-2-API](https://github.com/justlovemaki/AIClient-2-API)，用于维护 Kiro OAuth 场景下的个人修复。

## 应该用哪个分支？

**日常使用请拉 `personal/maintain-kiro`** — 这是唯一持续维护的分支，基于上游最新版本，包含所有修复。

## 分支一览

| 分支 | 基于版本 | 状态 | 说明 |
|------|---------|------|------|
| `personal/maintain-kiro` | v2.15.3 | ✅ **当前使用** | 包含 Opus 200K 修复 + Kiro IDE token 自动恢复，日常运行的版本 |
| `main` | v2.9.9 | ❌ 过时 | fork 时的初始状态，未同步上游，不要用 |
| `patch/pre-start-patch-v2` | v2.13.2.1 | ⚠️ 已归档 | 早期魔改版（改了 claude-kiro.js + master.js + provider-pool-manager.js），功能已被 `personal/maintain-kiro` 取代 |
| `fix/kiro-oauth-auto-recovery` | v2.15.3 | ⚠️ 已归档 | 提交给上游的 PR #531（被关闭），只有 Kiro 恢复没有 Opus 修复，已合并到 `personal/maintain-kiro` |
| `fix/opus-context-tokens-overflow` | v2.13.2.1 | ⚠️ 已归档 | 最早的 Opus 200K 单独修复，已合并到后续分支 |
| `patch/local-startup-hooks` | v2.13.2.1 | ⚠️ 已归档 | pre-start-patch.js 脚本方案（不改源码），已被原生改造取代 |

## `personal/maintain-kiro` 包含的修复

1. **Opus 上下文溢出修复**：所有 Opus 模型（含 4-7）的 `MODEL_CONTEXT_TOKENS` 从 1M 改为 200K
2. **Kiro IDE token 自动恢复**：反代 refresh 失败时自动从 `~/.aws/sso/cache/` 读取 Kiro IDE 的最新 token
3. **启动时自动同步**：如果加载的 token 已过期，启动时自动从 Kiro IDE 同步

## 如何使用

```bash
git clone https://github.com/lilyWhenVia/AIClient-2-API.git
cd AIClient-2-API
git checkout personal/maintain-kiro
npm install
npm start
```

## 如何跟进上游更新

```bash
git fetch origin          # origin = justlovemaki/AIClient-2-API
git merge origin/main     # 合并上游最新代码，解决冲突后 commit
git push myfork personal/maintain-kiro
```

注意合并后检查 `MODEL_CONTEXT_TOKENS` 是否被上游覆盖回 1M。

## 相关资源

- 上游仓库：https://github.com/justlovemaki/AIClient-2-API
- Issue #523（根因分析）：https://github.com/justlovemaki/AIClient-2-API/issues/523
- PR #531（被关闭）：https://github.com/justlovemaki/AIClient-2-API/pull/531
- 补丁脚本和文档维护仓库：https://github.com/lilyWhenVia/AIClient-2-API-Kiro-Patches
