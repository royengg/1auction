import type { Server } from "socket.io";

import { getRedis } from "./redis.js";
import { startAuctionFlow } from "./timer.js";
import {
  ServerEvent,
  type RoomStatus,
  type LiveItemState,
} from "@auction/shared";

const CONTROL_CHANNEL = "auction:control";

export type ControlMessage =
  | { type: "START_AUCTION"; roomId: string; auctioneerId: string }
  | { type: "ROOM_COMPLETED"; roomId: string };

export function publishControl(msg: ControlMessage): Promise<number> {
  const redis = getRedis();
  return redis.publish(CONTROL_CHANNEL, JSON.stringify(msg));
}

export function registerControlSubscriber(io: Server): void {
  const subscriber = getRedis().duplicate();
  subscriber.subscribe(CONTROL_CHANNEL);
  subscriber.on("message", (_channel, raw) => {
    let msg: ControlMessage;
    try {
      msg = JSON.parse(raw) as ControlMessage;
    } catch {
      return;
    }
    void handleControl(io, msg);
  });
}

async function handleControl(
  io: Server,
  msg: ControlMessage,
): Promise<void> {
  if (msg.type === "START_AUCTION") {
    const liveItem: LiveItemState | null = await startAuctionFlow(io, msg.roomId);
    if (liveItem) {
      io.to(msg.roomId).emit(ServerEvent.ROOM_STATUS_CHANGED, {
        status: "AUCTION" as RoomStatus,
      });
      io.to(msg.roomId).emit(ServerEvent.ACTIVE_ITEM_CHANGED, { item: liveItem });
    }
  }
}