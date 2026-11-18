#!/usr/bin/env node
// claude-mem 中央 worker 的本機轉發：替每個請求加上 Cloudflare Access service token。
// claude-mem 的 client 自己沒辦法帶 Access header，所以 CLAUDE_MEM_WORKER_URL 指到這個代理，
// 由它轉送到 Access 後面的 worker。只聽 127.0.0.1，不對區網開放。
//
// 設定（環境變數，或寫在 ~/.claude-mem/access-proxy.env，每行 KEY=VALUE；環境變數優先）：
//   CMEM_WORKER_ORIGIN       worker 的對外網址，例如 https://worker-xxxx.workers.dev（必填）
//   CF_ACCESS_CLIENT_ID      Access service token 的 Client ID（必填）
//   CF_ACCESS_CLIENT_SECRET  Access service token 的 Client Secret（必填）
//   CMEM_PROXY_PORT          本機監聽的 port，預設 37777
//   CMEM_PROXY_ENV_FILE      設定檔路徑，預設 ~/.claude-mem/access-proxy.env
//
// 用法：node access-proxy.mjs
// claude-mem 那邊不要設 CLAUDE_MEM_WORKER_URL（設了就不會帶 local API token），
// 改設 CLAUDE_MEM_WORKER_HOST=127.0.0.1、CLAUDE_MEM_WORKER_PORT=<CMEM_PROXY_PORT>，詳見 README。
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";

loadEnvFile(process.env.CMEM_PROXY_ENV_FILE || path.join(os.homedir(), ".claude-mem", "access-proxy.env"));

function loadEnvFile(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trimStart().startsWith("#")) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const origin = new URL(required("CMEM_WORKER_ORIGIN"));
const clientId = required("CF_ACCESS_CLIENT_ID");
const clientSecret = required("CF_ACCESS_CLIENT_SECRET");
const port = Number(process.env.CMEM_PROXY_PORT ?? 37777);
const transport = origin.protocol === "https:" ? https : http;
const agent = new transport.Agent({ keepAlive: true });

function required(name) {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    console.error(`[access-proxy] 缺少環境變數 ${name}`);
    process.exit(1);
  }
  return value;
}

// 逐跳（hop-by-hop）header 不轉送
const HOP = new Set(["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer"]);

const server = http.createServer((req, res) => {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k)) headers[k] = v;
  headers.host = origin.host; // worker 的 Host 白名單要看到對外網域
  headers["cf-access-client-id"] = clientId;
  headers["cf-access-client-secret"] = clientSecret;

  const upstream = transport.request(
    {
      protocol: origin.protocol,
      hostname: origin.hostname,
      port: origin.port || undefined,
      method: req.method,
      path: req.url,
      headers,
      agent,
    },
    (up) => {
      const location = up.headers.location ?? "";
      if (up.statusCode >= 300 && up.statusCode < 400 && location.includes("cloudflareaccess.com")) {
        console.error("[access-proxy] 被 Cloudflare Access 擋下：service token 不對，或 Access 應用程式沒有 Service Auth 規則");
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "cloudflare_access_denied" }));
        up.resume();
        return;
      }
      const out = {};
      for (const [k, v] of Object.entries(up.headers)) if (!HOP.has(k)) out[k] = v;
      res.writeHead(up.statusCode ?? 502, out);
      up.pipe(res); // SSE（/stream）也照樣串流
    },
  );
  upstream.on("error", (err) => {
    console.error(`[access-proxy] 連不到 worker：${err.message}`);
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "upstream_unreachable" }));
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[access-proxy] http://127.0.0.1:${port} → ${origin.origin}`);
});
