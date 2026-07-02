import type { Server } from "socket.io";

import { prisma } from "./prisma.js";
import { withDbRetry } from "./prisma-retry.js";
import {
  AUTO_ADVANCE_COOLDOWN_MS,
  allItemsResolved,
  cleanupRoomRedis,
  getActiveItemId,
  getRedisBidders,
  loadItemsFromDb,
  loadRoomMeta,
  nextItemAfter,
  readLiveItem,
  resolveItem,
  setActiveItemIndexRedis,
  setRoomStatus,
  startItem,
} from "./room-state.js";
import { ServerEvent, type ResolvedItem, type LiveItemState } from "@auction/shared";
import type { AuctionItem } from "@auction/shared";

type RoomIO = Server;

const activeTimers = new Map<string, NodeJS.Timeout>();
const cooldownTimers = new Map<string, NodeJS.Timeout>();
const cleanupTimers = new Map<string, NodeJS.Timeout>();

const CLEANUP_DELAY_MS = 60_000;

export function scheduleExpiry(
  io: RoomIO,
  roomId: string,
  itemId: string,
  endsAt: number,
): void {
  cancelExpiry(roomId, itemId);
  const delay = Math.max(0, endsAt - Date.now());
  const handle = setTimeout(() => {
    void onItemExpired(io, roomId, itemId);
  }, delay);
  activeTimers.set(timerKey(roomId, itemId), handle);
}

export function cancelExpiry(roomId: string, itemId?: string): void {
  if (itemId) {
    const key = timerKey(roomId, itemId);
    const handle = activeTimers.get(key);
    if (handle) {
      clearTimeout(handle);
      activeTimers.delete(key);
    }
  } else {
    for (const [key, handle] of activeTimers.entries()) {
      if (key.startsWith(`auction:room:${roomId}:item:`)) {
        clearTimeout(handle);
        activeTimers.delete(key);
      }
    }
  }
}

export function scheduleAutoAdvance(io: RoomIO, roomId: string): void {
  cancelAutoAdvance(roomId);
  const handle = setTimeout(() => {
    void advanceToNextItem(io, roomId);
  }, AUTO_ADVANCE_COOLDOWN_MS);
  cooldownTimers.set(roomId, handle);
}

export function cancelAutoAdvance(roomId: string): void {
  const handle = cooldownTimers.get(roomId);
  if (handle) {
    clearTimeout(handle);
    cooldownTimers.delete(roomId);
  }
}

function scheduleCleanup(roomId: string): void {
  cancelCleanup(roomId);
  const handle = setTimeout(() => {
    void cleanupRoomRedis(roomId);
    cleanupTimers.delete(roomId);
  }, CLEANUP_DELAY_MS);
  cleanupTimers.set(roomId, handle);
}

function cancelCleanup(roomId: string): void {
  const handle = cleanupTimers.get(roomId);
  if (handle) {
    clearTimeout(handle);
    cleanupTimers.delete(roomId);
  }
}

async function onItemExpired(io: RoomIO, roomId: string, itemId: string) {
  const meta = await loadRoomMeta(roomId);
  if (!meta) return;
  const items = await loadItemsFromDb(roomId);
  const item = items.find((i) => i.id === itemId);
  if (!item) return;
  if (item.status === "SOLD" || item.status === "UNSOLD") return;

  const resolved = await resolveItem(roomId, item);
  emitItemResolved(io, roomId, resolved);
  io.to(roomId).emit(ServerEvent.ITEM_STATE_UPDATE, {
    itemId,
    patch: { status: resolved.status },
  });

  scheduleAutoAdvance(io, roomId);
}

async function advanceToNextItem(io: RoomIO, roomId: string) {
  const meta = await loadRoomMeta(roomId);
  if (!meta) return;
  const items = await loadItemsFromDb(roomId);

  if (allItemsResolved(items)) {
    await completeRoom(io, roomId);
    return;
  }

  const activeItemId = await getActiveItemId(roomId);
  const currentItem = activeItemId
    ? items.find((i) => i.id === activeItemId)
    : null;
  const currentSlot = currentItem?.slotIndex ?? -1;
  const next = nextItemAfter(items, currentSlot);
  if (!next) {
    await completeRoom(io, roomId);
    return;
  }

  const liveItem = await startItem(roomId, next, meta.itemDurationSeconds);
  io.to(roomId).emit(ServerEvent.ACTIVE_ITEM_CHANGED, { item: liveItem });
  scheduleExpiry(io, roomId, next.id, liveItem.endsAt ?? Date.now());
}

async function completeRoom(io: RoomIO, roomId: string): Promise<void> {
  await setRoomStatus(roomId, "COMPLETED");
  await setActiveItemIndexRedis(roomId, null, null);
  cancelExpiry(roomId);
  io.to(roomId).emit(ServerEvent.ROOM_STATUS_CHANGED, { status: "COMPLETED" });
  io.to(roomId).emit(ServerEvent.ACTIVE_ITEM_CHANGED, { item: null });
  scheduleCleanup(roomId);
}

function timerKey(roomId: string, itemId: string): string {
  return `auction:room:${roomId}:item:${itemId}`;
}

function emitItemResolved(
  io: RoomIO,
  roomId: string,
  resolved: ResolvedItem,
): void {
  io.to(roomId).emit(ServerEvent.ITEM_RESOLVED, { item: resolved });
}

export async function startAuctionFlow(
  io: RoomIO,
  roomId: string,
): Promise<LiveItemState | null> {
  const meta = await loadRoomMeta(roomId);
  if (!meta) return null;
  const items = await loadItemsFromDb(roomId);
  if (items.length === 0) return null;
  const firstItem = items.find((i) => i.slotIndex === 0) ?? items[0];
  if (!firstItem) return null;
  const liveItem = await startItem(roomId, firstItem, meta.itemDurationSeconds);
  scheduleExpiry(io, roomId, firstItem.id, liveItem.endsAt ?? Date.now());
  return liveItem;
}

export async function rescheduleAllTimers(io: RoomIO): Promise<void> {
  const activeRooms = await withDbRetry(() =>
    prisma.room.findMany({
      where: { status: "AUCTION" },
      select: { id: true },
    }),
  );

  for (const room of activeRooms) {
    const roomId = room.id;
    const meta = await loadRoomMeta(roomId);
    if (!meta) continue;

    const items = await loadItemsFromDb(roomId);
    if (allItemsResolved(items)) {
      await completeRoom(io, roomId);
      continue;
    }

    const activeItemId = await getActiveItemId(roomId);
    if (!activeItemId) {
      await advanceToNextItem(io, roomId);
      continue;
    }

    const item = items.find((i) => i.id === activeItemId);
    if (!item) {
      await advanceToNextItem(io, roomId);
      continue;
    }

    if (item.status === "SOLD" || item.status === "UNSOLD") {
      await advanceToNextItem(io, roomId);
      continue;
    }

    const liveItem = await readLiveItem(roomId, item);
    if (liveItem.paused) continue;

    if (liveItem.endsAt === null || liveItem.endsAt <= Date.now()) {
      await onItemExpired(io, roomId, activeItemId);
    } else {
      scheduleExpiry(io, roomId, activeItemId, liveItem.endsAt);
    }
  }

  const completedRooms = await withDbRetry(() =>
    prisma.room.findMany({
      where: { status: "COMPLETED" },
      select: { id: true },
    }),
  );
  for (const room of completedRooms) {
    const bidders = await getRedisBidders(room.id);
    if (bidders.length > 0) {
      scheduleCleanup(room.id);
    }
  }
}

export function disposeTimer(roomId: string): void {
  cancelExpiry(roomId);
  cancelAutoAdvance(roomId);
  cancelCleanup(roomId);
}