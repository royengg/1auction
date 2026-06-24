import { config } from "dotenv";

config({ path: [".env", ".env.local", "../../.env", "../../.env.local"] });

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

export const publicEnv = {
  socketUrl: required("NEXT_PUBLIC_SOCKET_URL", process.env.NEXT_PUBLIC_SOCKET_URL),
} as const;

export const serverEnv = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  betterAuthSecret: process.env.BETTER_AUTH_SECRET ?? "",
  betterAuthUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  socketServerUrl: process.env.SOCKET_SERVER_URL ?? "http://localhost:3001",
  socketServerInternalUrl:
    process.env.SOCKET_SERVER_INTERNAL_URL ?? "http://socket-server:3001",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET ?? "",
} as const;

export function assertServerEnv(): void {
  const missing: string[] = [];
  if (!serverEnv.databaseUrl) missing.push("DATABASE_URL");
  if (!serverEnv.betterAuthSecret) missing.push("BETTER_AUTH_SECRET");
  if (!serverEnv.jwtSecret) missing.push("JWT_SECRET");
  if (missing.length > 0) {
    throw new Error(
      `Missing required server environment variables: ${missing.join(", ")}. See .env.example.`,
    );
  }
}