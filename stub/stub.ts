// 取代 cmem.ai 的兩個端點，讓官方 sync-api 不依賴 cmem.ai：
//   GET  /verify  —— sync-api 的 TOKEN_VERIFY_URL（驗 Bearer token + X-User-Id）
//   POST /project —— sync-api 的 INTERNAL_PROJECTOR_URL（官方會投影到 cmem.ai 網頁，這裡只回 ack）
// 環境變數：
//   SYNC_USERS        JSON，{"<userId>": "<token>"}，可放多個使用者
//   PROJECTOR_SECRET  跟 sync-api 的 CMEM_INTERNAL_PROJECTOR_SECRET 同一組
//   PORT              預設 8090
import { timingSafeEqual } from "node:crypto";

const users: Record<string, string> = JSON.parse(process.env.SYNC_USERS ?? "{}");
const projectorSecret = process.env.PROJECTOR_SECRET ?? "";
if (Object.keys(users).length === 0) throw new Error("SYNC_USERS is empty");
if (projectorSecret.length < 16) throw new Error("PROJECTOR_SECRET must be at least 16 characters");

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 8090),
  hostname: "0.0.0.0",
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/health") return new Response("ok");

    if (pathname === "/verify" && req.method === "GET") {
      const userId = (req.headers.get("X-User-Id") ?? "").trim();
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/, "").trim();
      const expected = users[userId];
      if (expected && token && same(token, expected)) return Response.json({ userId });
      return Response.json({ code: "invalid_token", error: "invalid token" }, { status: 401 });
    }

    if (pathname === "/project" && req.method === "POST") {
      if (!same(req.headers.get("Authorization") ?? "", `Bearer ${projectorSecret}`)) {
        return new Response(null, { status: 401 });
      }
      const body = (await req.json()) as { epoch?: unknown; through_seq?: unknown };
      return Response.json({ protocol_version: 1, epoch: body.epoch, projected_through_seq: body.through_seq });
    }

    return new Response(null, { status: 404 });
  },
});
console.log(`claude-mem hub stub listening on :${server.port}`);
