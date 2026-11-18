# claude-mem-hub

自架的 claude-mem SyncHub，部署在 Bethau。

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
