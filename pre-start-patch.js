// pre-start-patch.js
// 启动前自动应用本地 patch：
// 1. 将 Opus MODEL_CONTEXT_TOKENS 从 1M 改为 200K（修复 Claude Code 上下文溢出）
// 2. 将 provider_pools.json 中 checkHealth 设为 true（启用自动健康恢复）

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// === Patch 1: claude-kiro.js Opus context tokens ===
const kiroPath = path.join(ROOT, 'src', 'providers', 'claude', 'claude-kiro.js');
if (fs.existsSync(kiroPath)) {
    let content = fs.readFileSync(kiroPath, 'utf8');
    const opusPattern = /"claude-opus-4-\d+":\s*1000000/g;
    const matches = content.match(opusPattern);
    if (matches && matches.length > 0) {
        content = content.replace(opusPattern, (match) => match.replace('1000000', '200000'));
        fs.writeFileSync(kiroPath, content, 'utf8');
        console.log(`[PATCH] claude-kiro.js: Fixed ${matches.length} Opus MODEL_CONTEXT_TOKENS (1M -> 200K)`);
    } else {
        console.log('[PATCH] claude-kiro.js: Opus context tokens already at 200K, no change needed');
    }
} else {
    console.warn('[PATCH] claude-kiro.js not found, skipping');
}

// === Patch 2: provider_pools.json checkHealth ===
const poolPath = path.join(ROOT, 'configs', 'provider_pools.json');
if (fs.existsSync(poolPath)) {
    let poolContent = fs.readFileSync(poolPath, 'utf8');
    let changed = false;
    if (poolContent.includes('"checkHealth": false')) {
        poolContent = poolContent.replace(/"checkHealth": false/g, '"checkHealth": true');
        changed = true;
    }
    if (poolContent.includes('"isHealthy": false')) {
        poolContent = poolContent.replace(/"isHealthy": false/g, '"isHealthy": true');
        changed = true;
    }
    if (changed) {
        fs.writeFileSync(poolPath, poolContent, 'utf8');
        console.log('[PATCH] provider_pools.json: Enabled checkHealth and reset isHealthy');
    } else {
        console.log('[PATCH] provider_pools.json: checkHealth already enabled, no change needed');
    }
} else {
    console.log('[PATCH] provider_pools.json not found, skipping');
}

console.log('[PATCH] All patches applied successfully');