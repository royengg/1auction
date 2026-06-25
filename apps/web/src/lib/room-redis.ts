import "server-only";
import type { RoomParticipant } from "@auction/shared";

import { getRedis, Keys } from "./redis";

export async function seedBidderInRedis(
  roomId: string,
  participant: RoomParticipant,
): Promise<void> {
  const redis = getRedis();
  await redis.hset(
    Keys.bidders(roomId),
    participant.userId,
    JSON.stringify(participant),
  );
}

export async function isBidderInRoom(
  roomId: string,
  userId: string,
): Promise<boolean> {
  const redis = getRedis();
  return (await redis.hexists(Keys.bidders(roomId), userId)) === 1;
}

export async function removeBidderFromRedis(
  roomId: string,
  userId: string,
): Promise<void> {
  const redis = getRedis();
  await redis.hdel(Keys.bidders(roomId), userId);
}