import { prisma } from "./prisma.js";
import { getRedis } from "./redis.js";
import {
  biddersKey,
  itemKey,
  resolvedListKey,
  roomKey,
  spectatorsKey,
} from "./keys.js";
import {
  type AuctionItem,
  type LiveItemState,
  type LiveRoomState,
  type LiveBid,
  type ResolvedItem,
  type RoomParticipant,
  type RoomStatus,
  AUCTION_ROOM,
} from "@auction/shared";

export interface RoomMeta {
  id: string;
  code: string;
  status: RoomStatus;
  auctioneerId: string;
  perRoomBudget: number;
  minIncrement: number;
  itemDurationSeconds: number;
}

export async function loadRoomMeta(roomId: string): Promise<RoomMeta | null> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      code: true,
      status: true,
      auctioneerId: true,
      perRoomBudget: true,
      minIncrement: true,
      itemDurationSeconds: true,
    },
  });
  if (!room) return null;
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    auctioneerId: room.auctioneerId,
    perRoomBudget: room.perRoomBudget,
    minIncrement: room.minIncrement,
    itemDurationSeconds: room.itemDurationSeconds,
  };
}

export async function loadItemsFromDb(roomId: string): Promise<AuctionItem[]> {
  const items = await prisma.auctionItem.findMany({
    where: { roomId },
    orderBy: { slotIndex: "asc" },
  });
  return items.map((i) => ({
    id: i.id,
    roomId: i.roomId,
    slotIndex: i.slotIndex,
    name: i.name,
    description: i.description,
    imageUrl: i.imageUrl ?? null,
    startingPrice: i.startingPrice,
    status: i.status,
    winnerId: i.winnerId ?? null,
    winningBid: i.winningBid ?? null,
  }));
}

export async function loadParticipants(
  roomId: string,
  perRoomBudget: number,
): Promise<RoomParticipant[]> {
  const participants = await prisma.roomParticipant.findMany({
    where: { roomId },
    include: { user: { select: { name: true, activeRole: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return participants.map((p) => ({
    userId: p.userId,
    name: p.user?.name ?? "",
    role: p.user?.activeRole ?? "BIDDER",
    budget: p.budget,
    reserved: p.reserved,
    available: Math.max(0, p.budget - p.reserved - p.spent),
    spent: p.spent,
  })) as RoomParticipant[];
}

export async function syncBiddersToRedis(
  roomId: string,
  participants: RoomParticipant[],
): Promise<void> {
  const redis = getRedis();
  const hashEntries: string[] = [];
  for (const p of participants) {
    hashEntries.push(p.userId, JSON.stringify(p));
  }
  if (hashEntries.length > 0) {
    await redis.hset(biddersKey(roomId), ...hashEntries);
  }
}

export async function getRedisBidders(
  roomId: string,
): Promise<RoomParticipant[]> {
  const redis = getRedis();
  const all = await redis.hgetall(biddersKey(roomId));
  return Object.values(all)
    .map((json) => JSON.parse(json) as RoomParticipant)
    .sort((a, b) => a.userId.localeCompare(b.userId));
}

export async function initRoomRedisState(
  meta: RoomMeta,
  participants: RoomParticipant[],
): Promise<void> {
  const redis = getRedis();
  await redis.hset(roomKey(meta.id), {
    status: meta.status,
    auctioneerId: meta.auctioneerId,
    perRoomBudget: String(meta.perRoomBudget),
    minIncrement: String(meta.minIncrement),
    itemDurationSeconds: String(meta.itemDurationSeconds),
    activeItemIndex: "",
    paused: "0",
    pausedAccumulatedMs: "0",
  });
  await syncBiddersToRedis(meta.id, participants);
}

export async function readRoomStatus(roomId: string): Promise<RoomStatus | null> {
  const redis = getRedis();
  const status = await redis.hget(roomKey(roomId), "status");
  return (status as RoomStatus) ?? null;
}

export async function setRoomStatus(
  roomId: string,
  status: RoomStatus,
): Promise<void> {
  const redis = getRedis();
  await redis.hset(roomKey(roomId), "status", status);
  const data: { status: RoomStatus; completedAt?: Date } = { status };
  if (status === "COMPLETED") {
    data.completedAt = new Date();
  }
  await prisma.room
    .update({ where: { id: roomId }, data })
    .catch(() => {});
}

export async function startItem(
  roomId: string,
  item: AuctionItem,
  itemDurationSeconds: number,
): Promise<LiveItemState> {
  const redis = getRedis();
  const endsAt = Date.now() + itemDurationSeconds * 1000;
  const itemK = itemKey(roomId, item.id);
  await redis.hset(itemK, {
    slotIndex: String(item.slotIndex),
    name: item.name,
    imageUrl: item.imageUrl ?? "",
    startingPrice: String(item.startingPrice),
    status: "ACTIVE",
    highBidUserId: "",
    highBidUserName: "",
    highBidAmount: "0",
    highBidPlacedAtMs: "0",
    endsAt: String(endsAt),
    paused: "0",
    pausedAt: "0",
    pausedAccumulatedMs: "0",
  });
  await redis.hset(roomKey(roomId), {
    activeItemIndex: String(item.slotIndex),
    activeItemId: item.id,
  });
  await prisma.auctionItem
    .updateMany({
      where: { id: item.id, roomId, status: "PENDING" },
      data: { status: "ACTIVE" },
    })
    .catch(() => {});
  await prisma.room
    .update({
      where: { id: roomId },
      data: { activeItemIndex: item.slotIndex },
    })
    .catch(() => {});
  return liveItemFromRedis(roomId, item, {
    endsAt,
    paused: false,
    pausedAccumulatedMs: 0,
    highBid: null,
  });
}

function liveItemFromRedis(
  roomId: string,
  item: AuctionItem,
  state: {
    endsAt: number;
    paused: boolean;
    pausedAccumulatedMs: number;
    highBid: LiveBid | null;
  },
): LiveItemState {
  return {
    itemId: item.id,
    slotIndex: item.slotIndex,
    name: item.name,
    imageUrl: item.imageUrl,
    startingPrice: item.startingPrice,
    status: item.status,
    highBid: state.highBid,
    endsAt: state.endsAt > 0 ? state.endsAt : null,
    paused: state.paused,
    pausedAccumulatedMs: state.pausedAccumulatedMs,
  };
}

export async function readLiveItem(
  roomId: string,
  item: AuctionItem,
): Promise<LiveItemState> {
  const redis = getRedis();
  const hash = await redis.hgetall(itemKey(roomId, item.id));
  if (!hash || Object.keys(hash).length === 0) {
    return liveItemFromRedis(roomId, item, {
      endsAt: 0,
      paused: false,
      pausedAccumulatedMs: 0,
      highBid: null,
    });
  }

  const highUserId = hash.highBidUserId ?? "";
  const highAmount = Number(hash.highBidAmount ?? 0);
  const highBid: LiveBid | null =
    highUserId && highAmount > 0
      ? {
          userId: highUserId,
          userName: hash.highBidUserName ?? "",
          amount: highAmount,
          placedAt:
            hash.highBidPlacedAtMs && hash.highBidPlacedAtMs !== "0"
              ? new Date(Number(hash.highBidPlacedAtMs)).toISOString()
              : new Date(0).toISOString(),
        }
      : null;

  return {
    itemId: item.id,
    slotIndex: item.slotIndex,
    name: item.name,
    imageUrl: item.imageUrl,
    startingPrice: item.startingPrice,
    status: (hash.status as AuctionItem["status"]) ?? item.status,
    highBid,
    endsAt: hash.endsAt && hash.endsAt !== "0" ? Number(hash.endsAt) : null,
    paused: hash.paused === "1",
    pausedAccumulatedMs: Number(hash.pausedAccumulatedMs ?? 0),
  };
}

export async function pauseActiveItem(
  roomId: string,
  itemId: string,
): Promise<{ paused: boolean; endsAt: number | null } | null> {
  const redis = getRedis();
  const hash = await redis.hgetall(itemKey(roomId, itemId));
  if (!hash || Object.keys(hash).length === 0) return null;
  if (hash.paused === "1") {
    return {
      paused: true,
      endsAt: hash.endsAt && hash.endsAt !== "0" ? Number(hash.endsAt) : null,
    };
  }
  const now = Date.now();
  await redis.hset(itemKey(roomId, itemId), {
    paused: "1",
    pausedAt: String(now),
  });
  return {
    paused: true,
    endsAt: hash.endsAt && hash.endsAt !== "0" ? Number(hash.endsAt) : null,
  };
}

export async function resumeActiveItem(
  roomId: string,
  itemId: string,
): Promise<{ paused: boolean; endsAt: number | null } | null> {
  const redis = getRedis();
  const hash = await redis.hgetall(itemKey(roomId, itemId));
  if (!hash || Object.keys(hash).length === 0) return null;
  if (hash.paused !== "1") {
    return {
      paused: false,
      endsAt: hash.endsAt && hash.endsAt !== "0" ? Number(hash.endsAt) : null,
    };
  }
  const now = Date.now();
  const pausedAt = Number(hash.pausedAt ?? 0);
  const pausedDelta = pausedAt > 0 ? now - pausedAt : 0;
  const newAccumulated = Number(hash.pausedAccumulatedMs ?? 0) + pausedDelta;
  const oldEndsAt = Number(hash.endsAt ?? 0);
  const newEndsAt = oldEndsAt > 0 ? oldEndsAt + pausedDelta : 0;
  await redis.hset(itemKey(roomId, itemId), {
    paused: "0",
    pausedAt: "0",
    pausedAccumulatedMs: String(newAccumulated),
    endsAt: String(newEndsAt),
  });
  return {
    paused: false,
    endsAt: newEndsAt > 0 ? newEndsAt : null,
  };
}

export async function setActiveItemIndexRedis(
  roomId: string,
  slotIndex: number | null,
  itemId: string | null,
): Promise<void> {
  const redis = getRedis();
  await redis.hset(roomKey(roomId), {
    activeItemIndex: slotIndex === null ? "" : String(slotIndex),
    activeItemId: itemId ?? "",
  });
}

export async function getActiveItemId(roomId: string): Promise<string | null> {
  const redis = getRedis();
  const itemId = await redis.hget(roomKey(roomId), "activeItemId");
  return itemId && itemId !== "" ? itemId : null;
}

export async function resolveItem(
  roomId: string,
  item: AuctionItem,
): Promise<ResolvedItem> {
  const redis = getRedis();
  const hash = await redis.hgetall(itemKey(roomId, item.id));
  const highUserId = hash.highBidUserId ?? "";
  const highAmount = Number(hash.highBidAmount ?? 0);
  const hasWinner = highUserId !== "" && highAmount > 0;

  const winnerId = hasWinner ? highUserId : null;
  const winningBid = hasWinner ? highAmount : null;

  let winnerName: string | null = null;
  if (hasWinner) {
    const winnerJson = await redis.hget(biddersKey(roomId), winnerId!);
    if (winnerJson) {
      try {
        const winner = JSON.parse(winnerJson) as RoomParticipant;
        winner.spent = (winner.spent ?? 0) + highAmount;
        winner.reserved = Math.max(0, (winner.reserved ?? 0) - highAmount);
        winner.available = Math.max(
          0,
          (winner.budget ?? 0) - winner.spent - winner.reserved,
        );
        await redis.hset(biddersKey(roomId), winnerId!, JSON.stringify(winner));
        winnerName = winner.name;
      } catch (err) {
        console.error("[resolveItem] failed to update winner redis state:", err);
      }
    }
  }

  const newStatus = hasWinner ? "SOLD" : "UNSOLD";
  await redis.hset(itemKey(roomId, item.id), {
    status: newStatus,
    resolvedAtMs: String(Date.now()),
  });

  const resolved: ResolvedItem = {
    itemId: item.id,
    slotIndex: item.slotIndex,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    status: newStatus,
    winnerId,
    winnerName,
    winningBid,
    resolvedAt: new Date().toISOString(),
  };

  await redis.rpush(resolvedListKey(roomId), JSON.stringify(resolved));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.auctionItem.update({
        where: { id: item.id },
        data: {
          status: newStatus,
          winnerId,
          winningBid,
          resolvedAt: new Date(),
        },
      });

      if (hasWinner && winnerId) {
        await tx.winner.upsert({
          where: { roomId_itemId: { roomId, itemId: item.id } },
          update: {},
          create: { roomId, itemId: item.id, userId: winnerId, amount: highAmount },
        });
        await tx.roomParticipant.update({
          where: { roomId_userId: { roomId, userId: winnerId } },
          data: {
            reserved: { decrement: highAmount },
            spent: { increment: highAmount },
          },
        });
      }
    });
  } catch (err) {
    console.error("[resolveItem] prisma transaction failed:", err);
  }

  return resolved;
}

export async function getResolvedItems(
  roomId: string,
): Promise<ResolvedItem[]> {
  const redis = getRedis();
  const list = await redis.lrange(resolvedListKey(roomId), 0, -1);
  return list.map((json) => JSON.parse(json) as ResolvedItem);
}

export async function getSpectatorIds(roomId: string): Promise<string[]> {
  const redis = getRedis();
  return redis.smembers(spectatorsKey(roomId));
}

export async function buildRoomSnapshot(
  roomId: string,
): Promise<LiveRoomState | null> {
  const meta = await loadRoomMeta(roomId);
  if (!meta) return null;

  const items = await loadItemsFromDb(roomId);
  const bidders = await getRedisBidders(roomId);
  const resolvedItems = await getResolvedItems(roomId);
  const spectatorIds = await getSpectatorIds(roomId);

  const activeItemId = await getActiveItemId(roomId);
  let activeItem: LiveItemState | null = null;
  if (activeItemId) {
    const item = items.find((i) => i.id === activeItemId);
    if (item) {
      activeItem = await readLiveItem(roomId, item);
    }
  }

  return {
    roomId,
    status: meta.status,
    activeItem,
    bidders,
    spectatorIds,
    resolvedItems,
  };
}

export async function cleanupRoomRedis(roomId: string): Promise<void> {
  const redis = getRedis();
  const meta = await loadRoomMeta(roomId);
  if (!meta) return;
  const keys = [roomKey(roomId), biddersKey(roomId), resolvedListKey(roomId), spectatorsKey(roomId)];
  const items = await loadItemsFromDb(roomId);
  for (const item of items) {
    keys.push(itemKey(roomId, item.id));
  }
  await redis.del(...keys);
}

export function nextItemAfter(
  items: AuctionItem[],
  currentSlotIndex: number,
): AuctionItem | null {
  return (
    items.find((i) => i.slotIndex > currentSlotIndex && i.status === "PENDING") ??
    null
  );
}

export function allItemsResolved(items: AuctionItem[]): boolean {
  return items.every((i) => i.status === "SOLD" || i.status === "UNSOLD");
}

export function isFirstItemSlot(items: AuctionItem[]): number {
  return items.length > 0 ? items[0]!.slotIndex : 0;
}

export const AUTO_ADVANCE_COOLDOWN_MS =
  AUCTION_ROOM.AUTO_ADVANCE_COOLDOWN_SECONDS * 1000;