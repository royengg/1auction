import { PrismaClient } from "@prisma/client";
import { startKeepalive } from "./prisma-retry.js";

/**
 * Append pool_timeout to the DATABASE_URL if not already present.
 * This gives Prisma more time to acquire a connection from the pool,
 * which is critical for serverless databases (e.g. Neon) on cold starts.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || url.includes("pool_timeout")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}pool_timeout=30`;
}

const globalForPrisma = globalThis as unknown as {
  socketPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.socketPrisma ??
  new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.socketPrisma = prisma;
}

startKeepalive(prisma);