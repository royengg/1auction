# syntax=docker/dockerfile:1.7
# Socket server — multi-stage build: Bun for install, Node 22 for runtime.

# ─── 1. Deps stage ────────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS deps
WORKDIR /app

COPY package.json bunfig.toml ./
COPY apps/socket-server/package.json ./apps/socket-server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN bun install 

# ─── 2. Build stage ───────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS builder
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules

COPY package.json bunfig.toml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/socket-server ./apps/socket-server
COPY apps/web/prisma ./apps/web/prisma
COPY apps/web/package.json ./apps/web/package.json

RUN bun --filter @auction/shared build

WORKDIR /app/apps/socket-server
RUN bun run db:generate
RUN bun run build

# ─── 3. Runner ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/socket-server/package.json ./apps/socket-server/package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/socket-server/dist ./apps/socket-server/dist
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma ./apps/web/prisma

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "apps/socket-server/dist/index.js"]
