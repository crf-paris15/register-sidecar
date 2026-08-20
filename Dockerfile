FROM node:24-alpine AS alpine

# ------------------------- BASE -------------------------
FROM alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

# ------------------------- BUILDER -------------------------
FROM base AS builder

RUN apk update
RUN apk add --no-cache gcompat python3 make
WORKDIR /app

COPY package*json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY src ./src

RUN pnpm install --frozen-lockfile && \
    pnpm prune --prod

# ------------------------- RUNNER -------------------------
FROM base AS runner
WORKDIR /app

ARG GIT_TAG
ENV GIT_TAG=$GIT_TAG

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/src /app/dist
COPY --from=builder --chown=hono:nodejs /app/package.json /app/package.json

USER hono
EXPOSE 3003

CMD ["node", "/app/dist/app.ts"]