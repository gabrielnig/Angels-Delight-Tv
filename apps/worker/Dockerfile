# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/worker/Dockerfile .
FROM node:24-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @ad/worker...
# Workspace packages ship TypeScript source, so the worker runs through tsx instead of a compiled bundle.
RUN pnpm --filter @ad/worker deploy --legacy --prod /out

FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# Scratch space for encodes. compose.prod.yaml mounts a volume here, which keeps this owner.
RUN mkdir /scratch && chown node:node /scratch
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
CMD ["node_modules/.bin/tsx", "src/main.ts"]
