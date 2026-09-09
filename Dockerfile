FROM node:24-bookworm-slim AS base

# ------------------------- BASE -------------------------
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN corepack enable pnpm

# ------------------------- BUILDER -------------------------
FROM base AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY src ./src

RUN pnpm install --frozen-lockfile && \
    pnpm prune --prod

# ------------------------- RUNNER -------------------------
FROM base AS runner
WORKDIR /app

ARG GIT_TAG
ENV GIT_TAG=$GIT_TAG

RUN apt-get update && apt-get install -y --no-install-recommends \
    unzip \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --system --uid 1001 --create-home hono
RUN pnpx puppeteer browsers install chrome

COPY --from=builder --chown=hono:hono /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:hono /app/src /app/dist
COPY --from=builder --chown=hono:hono /app/package.json /app/package.json

USER hono
EXPOSE 3003

CMD ["node", "/app/dist/app.ts"]