import type { Server, Socket } from "socket.io";

import { getRedis } from "./redis.js";
import { roomKey } from "./keys.js";
import {
  loadItemsFromDb,
  loadRoomMeta,
  pauseActiveItem,
  resumeActiveItem,
  setRoomStatus,
  startItem,
} from "./room-state.js";
import { scheduleExpiry, cancelExpiry, startAuctionFlow } from "./timer.js";
import {
  ServerEvent,
  type Ack,
  type LiveItemState,
} from "@auction/shared";

export async function handleStartAuction(
  io: Server,
  socket: Socket,
  _payload: unknown,
  ack: Ack<{ activeItem: LiveItemState | null }>,
): Promise<void> {
  const user = socket.data.user;
  const roomId = socket.data.roomId;
  if (!user || !roomId) {
    ack({ ok: false, error: { message: "not in a room" } });
    return;
  }

  const meta = await loadRoomMeta(roomId);
  if (!meta) {
    ack({ ok: false, error: { message: "room not found" } });
    return;
  }
  if (meta.auctioneerId !== user.id) {
    ack({ ok: false, error: { message: "only the auctioneer can start" } });
    return;
  }
  if (meta.status !== "LOBBY") {
    ack({ ok: false, error: { message: `room is already ${meta.status}` } });
    return;
  }

  const items = await loadItemsFromDb(roomId);
  if (items.length === 0) {
    ack({ ok: false, error: { message: "no items to auction" } });
    return;
  }

  await setRoomStatus(roomId, "AUCTION");
  io.to(roomId).emit(ServerEvent.ROOM_STATUS_CHANGED, { status: "AUCTION" });

  const firstItem = items.find((i) => i.slotIndex === 0) ?? items[0]!;
  const liveItem = await startItem(roomId, firstItem, meta.itemDurationSeconds);
  scheduleExpiry(io, roomId, firstItem.id, liveItem.endsAt ?? Date.now());

  io.to(roomId).emit(ServerEvent.ACTIVE_ITEM_CHANGED, { item: liveItem });
  ack({ ok: true, data: { activeItem: liveItem } });
}

export async function handlePause(
  io: Server,
  socket: Socket,
  _payload: unknown,
  ack: Ack<{ paused: boolean; endsAt: number | null }>,
): Promise<void> {
  const user = socket.data.user;
  const roomId = socket.data.roomId;
  if (!user || !roomId) {
    ack({ ok: false, error: { message: "not in a room" } });
    return;
  }

  const meta = await loadRoomMeta(roomId);
  if (!meta || meta.auctioneerId !== user.id) {
    ack({ ok: false, error: { message: "only the auctioneer can pause" } });
    return;
  }

  const redis = getRedis();
  const activeItemId = await redis.hget(roomKey(roomId), "activeItemId");
  if (!activeItemId) {
    ack({ ok: false, error: { message: "no active item to pause" } });
    return;
  }

  const result = await pauseActiveItem(roomId, activeItemId);
  if (!result) {
    ack({ ok: false, error: { message: "item state not found" } });
    return;
  }

  cancelExpiry(roomId, activeItemId);
  io.to(roomId).emit(ServerEvent.PAUSE_STATE, {
    paused: true,
    endsAt: result.endsAt,
  });
  io.to(roomId).emit(ServerEvent.ITEM_STATE_UPDATE, {
    itemId: activeItemId,
    patch: { paused: true },
  });
  ack({ ok: true, data: result });
}

export async function handleResume(
  io: Server,
  socket: Socket,
  _payload: unknown,
  ack: Ack<{ paused: boolean; endsAt: number | null }>,
): Promise<void> {
  const user = socket.data.user;
  const roomId = socket.data.roomId;
  if (!user || !roomId) {
    ack({ ok: false, error: { message: "not in a room" } });
    return;
  }

  const meta = await loadRoomMeta(roomId);
  if (!meta || meta.auctioneerId !== user.id) {
    ack({ ok: false, error: { message: "only the auctioneer can resume" } });
    return;
  }

  const redis = getRedis();
  const activeItemId = await redis.hget(roomKey(roomId), "activeItemId");
  if (!activeItemId) {
    ack({ ok: false, error: { message: "no active item to resume" } });
    return;
  }

  const result = await resumeActiveItem(roomId, activeItemId);
  if (!result) {
    ack({ ok: false, error: { message: "item state not found" } });
    return;
  }

  if (result.endsAt) {
    scheduleExpiry(io, roomId, activeItemId, result.endsAt);
  }

  io.to(roomId).emit(ServerEvent.PAUSE_STATE, {
    paused: false,
    endsAt: result.endsAt,
  });
  io.to(roomId).emit(ServerEvent.ITEM_STATE_UPDATE, {
    itemId: activeItemId,
    patch: { paused: false },
  });
  ack({ ok: true, data: result });
}

export { startAuctionFlow };