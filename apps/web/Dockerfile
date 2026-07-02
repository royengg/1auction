# syntax=docker/dockerfile:1.7
# Web app — multi-stage build: Bun for install, Node 22 for runtime.

# ─── 1. Deps stage ────────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS deps
WORKDIR /app

COPY package.json bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY apps/socket-server/package.json ./apps/socket-server/
COPY packages/shared/package.json ./packages/shared/

RUN bun install 

# ─── 2. Build stage ───────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules

COPY package.json bunfig.toml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY apps/socket-server/package.json ./apps/socket-server/package.json

RUN bun --filter @auction/shared build

WORKDIR /app/apps/web
RUN bun run db:generate
RUN bun run build

# ─── 3. Runner ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared/package.json ./packages/shared/package.json

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
