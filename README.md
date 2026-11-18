# claude-mem-hub

自架的 claude-mem 服務，部署在 Bethau。兩種架構擇一使用：

- **SyncHub**（`hub/` + `stub/`）：每台機器各有一份記憶，透過 hub 互相同步。
- **中央 worker**（`worker/`）：只有中央一份，所有 client 用 `CLAUDE_MEM_WORKER_URL` 連過來，viewer 就是管理頁。

- `hub/`：官方 `services/sync-api`（protocol v2），Dockerfile 建置時從 `thedotmack/claude-mem` 抓固定的 commit（`CLAUDE_MEM_REF`）。
- `stub/`：取代 cmem.ai 的兩個端點，讓 hub 不需要 cmem.ai Pro：
  - `GET /verify`：hub 的 `TOKEN_VERIFY_URL`，用 `SYNC_USERS` 驗 token 與 user id
  - `POST /project`：hub 的 `INTERNAL_PROJECTOR_URL`，只回 ack（沒有 cmem.ai 網頁後台，機器之間的同步不受影響）

## 環境變數

**stub**
| 名稱 | 值 |
|---|---|
| `SYNC_USERS` | `{"<userId>":"<token>"}` |
| `PROJECTOR_SECRET` | 至少 16 字元的隨機字串 |

**hub**
| 名稱 | 值 |
|---|---|
| `DATABASE_URL` | `postgres://<user>:<pw>@postgresql:5432/<db>` |
| `TOKEN_VERIFY_URL` | `http://stub:8090/verify` |
| `INTERNAL_PROJECTOR_URL` | `http://stub:8090/project` |
| `CMEM_INTERNAL_PROJECTOR_SECRET` | 跟 stub 的 `PROJECTOR_SECRET` 同一組 |

## Client（每個開發環境）

`~/.claude-mem/settings.json`：

```json
"CLAUDE_MEM_CLOUD_SYNC_TOKEN": "<token>",
"CLAUDE_MEM_CLOUD_SYNC_USER_ID": "<userId>",
"CLAUDE_MEM_CLOUD_SYNC_HUB_URL": "https://<hub 網域>"
```

重啟 worker 後，`curl -s localhost:<worker port>/api/sync/status` 要看到 `hub.reachable: true`。

## 注意

- Hub URL 必須是 `https://`。
- 自架沒有即時推送的 grant endpoint，同步走 HTTP polling。
- 升級 `CLAUDE_MEM_REF` 前，先確認 sync 協定沒有破壞性變更。

## 中央 worker（`worker/`）

在容器裡跑官方 claude-mem worker（npm 套件 `claude-mem`，版本由 `CLAUDE_MEM_VERSION` 固定），資料全在 `/data`，**一定要掛硬碟**。

兩層保護：
- **網路層**：Cloudflare Access。瀏覽器用 email 登入看 viewer；開發環境用 service token（Service Auth 規則）。
- **應用層**：`CLAUDE_MEM_LOCAL_API_TOKEN`，保護 `/api/health` 以外的整個 API。官方只從 settings.json 讀它，所以由 `entrypoint.sh` 把 `CMEM_LOCAL_API_TOKEN` 寫進去。

連線路徑：
```
plugin（帶 x-claude-mem-token）→ 127.0.0.1:37777 本機轉發（帶 Access service token）
  → Cloudflare Access → Tunnel → worker（驗 local API token）
```

### worker 環境變數（Bethau）
| 名稱 | 值 |
|---|---|
| `CMEM_LOCAL_API_TOKEN` | 長隨機字串（≥16 字元），client 要填同一組 |
| `CLAUDE_MEM_WORKER_INGEST_TOKEN` | 長隨機字串，client 要填同一組 |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` 產生，用來產生 observation |
| `CLAUDE_MEM_ALLOWED_ORIGINS` | worker 對外網址（Host 白名單） |

### client（每個開發環境）

1. 停掉本機 worker。
2. 本機轉發（`client/`）：把 `access-proxy.env.example` 填好存成 `~/.claude-mem/access-proxy.env`，再設成開機自動啟動：
   - Windows：`powershell -ExecutionPolicy Bypass -File .\install-windows.ps1`
   - Linux：照 `claude-mem-access-proxy.service` 開頭的註解安裝 systemd 使用者服務
   - 手動：`node access-proxy.mjs`
3. `~/.claude-mem/settings.json` 加上：
   ```json
   "CLAUDE_MEM_WORKER_HOST": "127.0.0.1",
   "CLAUDE_MEM_WORKER_PORT": "37777",
   "CLAUDE_MEM_WORKER_AUTOSTART": "false",
   "CLAUDE_MEM_HOOK_SPOOL_TRANSPORT": "http",
   "CLAUDE_MEM_WORKER_INGEST_TOKEN": "<同 worker>",
   "CLAUDE_MEM_LOCAL_API_TOKEN": "<同 worker>"
   ```
   **不要設 `CLAUDE_MEM_WORKER_URL`**：設了 plugin 就不會帶 local API token，所有請求都會被 worker 拒絕（16.0.0 實測）。
4. 開新的 Claude Code session。

升級：plugin 升級前先把 `worker/Dockerfile` 的 `CLAUDE_MEM_VERSION` 改成同一版並重新部署（先升 worker 再升 client）。
