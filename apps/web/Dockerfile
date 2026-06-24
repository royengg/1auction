# syntax=docker/dockerfile:1.7
# Web app image — multi-stage build with Bun for install, Node for runtime.

# ─── 1. Deps stage ────────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS deps
WORKDIR /app
# Copy workspace manifests first for caching.
COPY package.json bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile=false

# ─── 2. Build stage ───────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json bunfig.toml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN bun --filter @auction/shared build
WORKDIR /app/apps/web
RUN bun run db:generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ─── 3. Runner ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Copy the standalone output produced by Next.js.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]