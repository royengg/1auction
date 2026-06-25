import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  socketPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.socketPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.socketPrisma = prisma;
}