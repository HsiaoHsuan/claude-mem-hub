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

worker 的讀取 API 沒有驗證，不能直接公開。請放在 Cloudflare Tunnel + Access（service token）後面，client 用 `cloudflared access` 轉到本機再連。

**worker 環境變數**
| 名稱 | 值 |
|---|---|
| `CLAUDE_MEM_WORKER_INGEST_TOKEN` | 長隨機字串，client 要填同一組 |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` 產生的長效 token，用來產生 observation |
| `CLAUDE_MEM_ALLOWED_ORIGINS` | worker 對外網址，例如 `https://mem.example.com`（Host 白名單） |

**client（每個開發環境）** `~/.claude-mem/settings.json`：
```json
"CLAUDE_MEM_WORKER_URL": "http://127.0.0.1:37777",
"CLAUDE_MEM_WORKER_INGEST_TOKEN": "<同一組>"
```
設好後本機不會再啟動 worker；原本在跑的要先停掉。
