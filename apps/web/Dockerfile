# syntax=docker/dockerfile:1.7
# Web app — multi-stage build: Bun for install, Node 22 for runtime.

# ─── 1. Deps stage ────────────────────────────────────────────────────────────
FROM oven/bun:1.2 AS deps
WORKDIR /app

COPY package.json bunfig.toml bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/socket-server/package.json ./apps/socket-server/
COPY packages/shared/package.json ./packages/shared/

RUN bun install 

# ─── 2. Build stage ───────────────────────────────────────────────────────────
FROM oven/bun:1.2 AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BETTER_AUTH_SECRET=placeholder-for-build
ENV JWT_SECRET=placeholder-for-build
ENV DATABASE_URL=placeholder-for-build
ENV NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
ENV BETTER_AUTH_URL=http://localhost:3000
ENV WEB_ORIGIN=http://localhost:3000
ENV SOCKET_SERVER_INTERNAL_URL=http://localhost:3001
ENV REDIS_URL=redis://localhost:6379

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

# Next.js standalone output + full node_modules (Bun monorepo hoisting
# prevents standalone from tracing deps correctly, so we copy the whole tree)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared/package.json ./packages/shared/package.json

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
