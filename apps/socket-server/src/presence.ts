import type { Server, Socket } from "socket.io";

import { getRedis } from "./redis.js";
import { presenceKey } from "./keys.js";
import { ServerEvent } from "@auction/shared";

const PRESENCE_TTL_SECONDS = 60;

export async function markPresent(roomId: string, userId: string): Promise<void> {
  const redis = getRedis();
  await redis.sadd(presenceKey(roomId), userId);
  await redis.expire(presenceKey(roomId), PRESENCE_TTL_SECONDS);
}

export async function markAbsent(
  roomId: string,
  userId: string,
): Promise<void> {
  const redis = getRedis();
  await redis.srem(presenceKey(roomId), userId);
}

export async function listPresent(roomId: string): Promise<string[]> {
  const redis = getRedis();
  return redis.smembers(presenceKey(roomId));
}

export function broadcastPresence(io: Server, roomId: string): Promise<void> {
  return listPresent(roomId).then((userIds) => {
    io.to(roomId).emit(ServerEvent.PRESENCE, { roomId, userIds });
  });
}