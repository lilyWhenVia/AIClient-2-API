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


// === Patch 3: Sync Kiro token from IDE source ===
const KIRO_CACHE_DIR = require('path').join(require('os').homedir(), '.aws', 'sso', 'cache');
try {
    const cacheFiles = fs.readdirSync(KIRO_CACHE_DIR).filter(f => f.endsWith('.json'));
    
    // Find token source (has accessToken + refreshToken)
    let tokenContent = null;
    let tokenName = null;
    let latestMtime = 0;
    for (const f of cacheFiles) {
        const fp = path.join(KIRO_CACHE_DIR, f);
        const stat = fs.statSync(fp);
        const c = JSON.parse(fs.readFileSync(fp, 'utf8'));
        if (c.accessToken && c.refreshToken && stat.mtimeMs > latestMtime) {
            tokenContent = c;
            tokenName = f;
            latestMtime = stat.mtimeMs;
        }
    }
    
    // Find client source (has clientId + clientSecret)
    let clientId = null, clientSecret = null;
    for (const f of cacheFiles) {
        const c = JSON.parse(fs.readFileSync(path.join(KIRO_CACHE_DIR, f), 'utf8'));
        if (c.clientId && c.clientSecret) { clientId = c.clientId; clientSecret = c.clientSecret; break; }
    }
    
    if (tokenContent && clientId) {
        // Find proxy cred file from pool config
        const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
        const providers = pool['claude-kiro-oauth'];
        if (providers && providers.length > 0) {
            const credRelPath = providers[0].KIRO_OAUTH_CREDS_FILE_PATH;
            const credPath = path.resolve(ROOT, credRelPath);
            if (fs.existsSync(credPath)) {
                const existing = JSON.parse(fs.readFileSync(credPath, 'utf8'));
                const merged = { ...existing, accessToken: tokenContent.accessToken, refreshToken: tokenContent.refreshToken, expiresAt: tokenContent.expiresAt, clientId, clientSecret };
                if (tokenContent.profileArn) merged.profileArn = tokenContent.profileArn;
                fs.writeFileSync(credPath, JSON.stringify(merged, null, 2), 'utf8');
                console.log(`[PATCH] Synced Kiro token from ${tokenName} (expires: ${tokenContent.expiresAt})`);
            }
        }
    } else {
        console.log('[PATCH] No valid Kiro source token found, skipping sync');
    }
} catch (e) {
    console.log(`[PATCH] Kiro token sync skipped: ${e.message}`);
}

console.log('[PATCH] All patches applied successfully');