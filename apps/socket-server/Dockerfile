# syntax=docker/dockerfile:1.7
# Socket server — runtime: Node 22. Install via Bun for speed.

# ─── 1. Deps stage ────────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS deps
WORKDIR /app
COPY package.json bunfig.toml ./
COPY apps/socket-server/package.json ./apps/socket-server/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile=false

# ─── 2. Build stage ───────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/socket-server/node_modules ./apps/socket-server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json bunfig.toml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/socket-server ./apps/socket-server
RUN bun --filter @auction/shared build
WORKDIR /app/apps/socket-server
RUN bun run build

# ─── 3. Runner ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/socket-server/node_modules ./apps/socket-server/node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/socket-server/package.json ./apps/socket-server/package.json
COPY --from=builder /app/apps/socket-server/dist ./dist
USER nextjs
EXPOSE 3001
CMD ["node", "dist/index.js"]