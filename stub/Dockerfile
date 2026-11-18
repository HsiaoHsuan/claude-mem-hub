FROM oven/bun:1.4-debian
WORKDIR /app
COPY stub.ts ./
ENV PORT=8090
EXPOSE 8090
USER bun
CMD ["bun", "run", "stub.ts"]
