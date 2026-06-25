import "server-only";
import { Redis } from "ioredis";
import { serverEnv } from "./env";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  client = new Redis(serverEnv.redisUrl, {
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

export const Keys = {
  room: (roomId: string) => `auction:room:${roomId}`,
  bidders: (roomId: string) => `auction:room:${roomId}:bidders`,
  item: (roomId: string, itemId: string) =>
    `auction:room:${roomId}:item:${itemId}`,
  resolved: (roomId: string) => `auction:room:${roomId}:resolved`,
  presence: (roomId: string) => `auction:room:${roomId}:presence`,
} as const;