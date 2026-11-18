#!/bin/sh
# 把 Bethau 的環境變數 CMEM_LOCAL_API_TOKEN 寫進 worker 的 settings.json。
# claude-mem 刻意只從 settings.json 讀 CLAUDE_MEM_LOCAL_API_TOKEN（環境變數無效），
# 這個 token 保護 /api/health 以外的整個 worker API。
set -eu
SETTINGS="$HOME/.claude-mem/settings.json"
mkdir -p "$(dirname "$SETTINGS")"

node - "$SETTINGS" <<'EOF'
const fs = require("fs");
const file = process.argv[2];
const token = (process.env.CMEM_LOCAL_API_TOKEN || "").trim();
let settings = {};
try { settings = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
const target = settings.env && typeof settings.env === "object" ? settings.env : settings;
if (token) {
  if (token.length < 16) { console.error("[entrypoint] CMEM_LOCAL_API_TOKEN 至少要 16 個字元"); process.exit(1); }
  target.CLAUDE_MEM_LOCAL_API_TOKEN = token;
} else {
  delete target.CLAUDE_MEM_LOCAL_API_TOKEN;
  console.warn("[entrypoint] 沒有設 CMEM_LOCAL_API_TOKEN：worker API 沒有應用層驗證");
}
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600 });
fs.chmodSync(file, 0o600);
EOF

exec bun /opt/claude-mem/plugin/scripts/worker-service.cjs --daemon
