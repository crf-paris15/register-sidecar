FROM node:24-bookworm-slim AS base

# ------------------------- BASE -------------------------
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable pnpm

# ------------------------- BUILDER -------------------------
FROM base AS builder

ENV PUPPETEER_SKIP_DOWNLOAD=true

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

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --system --uid 1001 --create-home hono

COPY --from=builder --chown=hono:hono /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:hono /app/src /app/dist
COPY --from=builder --chown=hono:hono /app/package.json /app/package.json

USER hono
EXPOSE 3003

CMD ["node", "/app/dist/app.ts"]