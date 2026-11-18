# claude-mem 官方 sync-api（SyncHub protocol v2），建置時從上游抓固定的 commit。
# 升級：改 CLAUDE_MEM_REF，重新部署前先確認協定沒有破壞性變更。
FROM oven/bun:1.4-debian AS source
ARG CLAUDE_MEM_REF=cc4dbf5beb4bd98623e0b842e6617115f4e74631
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN git init -q /src \
 && cd /src \
 && git remote add origin https://github.com/thedotmack/claude-mem \
 && git sparse-checkout set services/sync-api \
 && git fetch -q --depth 1 origin "$CLAUDE_MEM_REF" \
 && git checkout -q FETCH_HEAD

FROM oven/bun:1.4-debian
RUN groupadd --system --gid 1001 cmem \
 && useradd --system --uid 1001 --gid cmem --no-create-home --shell /usr/sbin/nologin cmem
WORKDIR /app
COPY --from=source /src/services/sync-api/package.json /src/services/sync-api/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=source /src/services/sync-api/src ./src
ENV PORT=8080
ENV HOST=0.0.0.0
EXPOSE 8080
USER cmem
CMD ["bun", "run", "src/index.ts"]
