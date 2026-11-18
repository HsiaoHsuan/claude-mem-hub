# claude-mem 中央 worker（remote worker capture）。
# 所有 client 設 CLAUDE_MEM_WORKER_URL 指到這裡；資料（SQLite、Chroma、log）都在 /data。
FROM oven/bun:1.4-debian AS bun
FROM ghcr.io/astral-sh/uv:0.9 AS uv

FROM node:22-bookworm-slim
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=uv /uv /uvx /usr/local/bin/
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git python3 tini \
 && rm -rf /var/lib/apt/lists/*

# 產生 observation 用的 Claude Code CLI（worker 透過 Agent SDK 呼叫它）
ARG CLAUDE_CODE_VERSION=latest
RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" && npm cache clean --force

# claude-mem 本體（npm 套件裡的 plugin/）
ARG CLAUDE_MEM_VERSION=16.0.0
RUN mkdir -p /opt/claude-mem \
 && curl -fsSL "https://registry.npmjs.org/claude-mem/-/claude-mem-${CLAUDE_MEM_VERSION}.tgz" \
    | tar xz -C /opt/claude-mem --strip-components=1 \
 && cd /opt/claude-mem/plugin \
 && bun install --production

ENV HOME=/data \
    CLAUDE_PLUGIN_ROOT=/opt/claude-mem/plugin \
    CLAUDE_MEM_WORKER_HOST=0.0.0.0 \
    CLAUDE_MEM_WORKER_PORT=37777
WORKDIR /data
VOLUME /data
EXPOSE 37777
ENTRYPOINT ["tini", "--"]
CMD ["bun", "/opt/claude-mem/plugin/scripts/worker-service.cjs", "--daemon"]
