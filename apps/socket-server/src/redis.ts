import { Redis } from "ioredis";
import { env } from "./env.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  client = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    console.error("[redis] error:", err);
  });
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}