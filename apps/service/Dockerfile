FROM node:24-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git tini \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

WORKDIR /app

FROM base AS manifests

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/service/package.json apps/service/package.json
COPY packages/harbor-events/package.json packages/harbor-events/package.json

FROM manifests AS build-deps

RUN pnpm install --frozen-lockfile --filter @harbor/service...

FROM build-deps AS builder

COPY scripts ./scripts
COPY apps/service ./apps/service

RUN pnpm --dir apps/service exec prisma generate
RUN pnpm --dir apps/service build

FROM manifests AS runtime-deps

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

RUN pnpm install --frozen-lockfile --prod --filter @harbor/service...

FROM base AS runtime

ARG APP_VERSION=0.0.0-dev
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=runtime-deps /app/apps/service/package.json ./apps/service/package.json
COPY --from=runtime-deps /app/apps/service/node_modules ./apps/service/node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/apps/service/dist ./apps/service/dist
COPY --from=builder /app/apps/service/prisma ./apps/service/prisma
COPY --from=builder /app/apps/service/prisma.config.ts ./apps/service/prisma.config.ts
COPY --from=builder /app/apps/service/harbor.config.json ./apps/service/harbor.config.json
COPY --from=builder /app/apps/service/harbor.docker.json ./apps/service/harbor.docker.json
COPY --from=builder /app/apps/service/public-skills ./apps/service/public-skills
COPY --from=builder /app/apps/service/docker-entrypoint.sh ./apps/service/docker-entrypoint.sh

RUN pnpm --dir apps/service exec prisma generate

RUN mkdir -p /var/lib/harbor /workspace \
  && chmod +x /app/apps/service/docker-entrypoint.sh

ENV NODE_ENV=production \
  APP_VERSION=$APP_VERSION \
  GIT_SHA=$GIT_SHA \
  BUILD_TIME=$BUILD_TIME \
  HARBOR_CONFIG_PATH=/app/apps/service/harbor.docker.json

EXPOSE 3400

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3400/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["tini", "--", "/app/apps/service/docker-entrypoint.sh"]
