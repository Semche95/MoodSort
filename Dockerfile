FROM node:26-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html tsconfig.json vite.config.ts ./
COPY scripts ./scripts
COPY src ./src
RUN pnpm build

FROM caddy:2-alpine AS serve

RUN addgroup -S caddy && adduser -S -G caddy caddy \
    && mkdir -p /config/caddy /data/caddy \
    && chown -R caddy:caddy /config /data

COPY --chown=caddy:caddy Caddyfile /etc/caddy/Caddyfile
COPY --from=build --chown=caddy:caddy /app/dist /usr/share/caddy

USER caddy
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/ || exit 1
