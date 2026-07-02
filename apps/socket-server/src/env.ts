import { config } from "dotenv";

config({ path: [".env", ".env.local", "../../.env", "../../.env.local"], override: false });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.SOCKET_SERVER_PORT ?? 3001),
  webOrigin: required("WEB_ORIGIN", "http://localhost:3000"),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  jwtSecret: required("JWT_SECRET"),
} as const;