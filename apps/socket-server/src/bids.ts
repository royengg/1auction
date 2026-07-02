import type { Server, Socket } from "socket.io";

import { getRedis } from "./redis.js";
import { biddersKey, itemKey } from "./keys.js";
import { loadRoomMeta } from "./room-state.js";
import { BID_SCRIPT } from "./bid-script.js";
import {
  ServerEvent,
  type Ack,
  type BidRejectReason,
  type LiveBid,
  type RoomParticipant,
} from "@auction/shared";
import { prisma } from "./prisma.js";
import { withDbRetry } from "./prisma-retry.js";

const BID_COOLDOWN_MS = 500;
const lastBidTimestamps = new Map<string, number>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const lastBid = lastBidTimestamps.get(userId);
  if (lastBid !== undefined && now - lastBid < BID_COOLDOWN_MS) {
    return true;
  }
  lastBidTimestamps.set(userId, now);
  return false;
}

export function clearBidRateLimit(userId: string): void {
  lastBidTimestamps.delete(userId);
}

async function runBidScript(
  redis: ReturnType<typeof getRedis>,
  roomId: string,
  activeItemId: string,
  userId: string,
  userName: string,
  amount: number,
  minIncrement: number,
  nowMs: number,
): Promise<unknown> {
  const isoNow = new Date(nowMs).toISOString();
  return redis.eval(
    BID_SCRIPT,
    2,
    itemKey(roomId, activeItemId),
    biddersKey(roomId),
    userId,
    userName,
    String(amount),
    String(minIncrement),
    String(nowMs),
    isoNow,
  );
}

async function getActiveItemId(roomId: string): Promise<string | null> {
  const redis = getRedis();
  const id = await redis.hget(`auction:room:${roomId}`, "activeItemId");
  return id && id !== "" ? id : null;
}

export async function placeBid(
  io: Server,
  socket: Socket,
  payload: unknown,
  ack: Ack<{ highBid: LiveBid | null; bidders: RoomParticipant[] }>,
): Promise<void> {
  const user = socket.data.user;
  const roomId = socket.data.roomId;
  if (!user || !roomId) {
    ack({ ok: false, error: { message: "not in a room", reason: "NOT_AUTHENTICATED" } });
    return;
  }

  if (isRateLimited(user.id)) {
    ack({
      ok: false,
      error: {
        message: `Please wait ${BID_COOLDOWN_MS}ms between bids.`,
        reason: "RATE_LIMITED",
      },
    });
    return;
  }

  const amount =
    typeof payload === "object" &&
    payload &&
    "amount" in payload &&
    typeof (payload as { amount?: unknown }).amount === "number" &&
    Number.isInteger((payload as { amount: number }).amount)
      ? (payload as { amount: number }).amount
      : null;

  if (!amount || amount <= 0) {
    ack({ ok: false, error: { message: "amount must be a positive integer", reason: "BID_TOO_LOW" } });
    return;
  }

  const meta = await loadRoomMeta(roomId);
  if (!meta) {
    ack({ ok: false, error: { message: "room not found", reason: "INTERNAL_ERROR" } });
    return;
  }
  if (meta.auctioneerId === user.id) {
    ack({ ok: false, error: { message: "auctioneer cannot bid in their own room", reason: "AUCTIONEER_CANNOT_BID" } });
    return;
  }
  if (meta.status !== "AUCTION") {
    ack({ ok: false, error: { message: "auction not active", reason: "ROOM_NOT_AUCTION" } });
    return;
  }

  const activeItemId = await getActiveItemId(roomId);
  if (!activeItemId) {
    ack({ ok: false, error: { message: "no active item", reason: "ITEM_NOT_ACTIVE" } });
    return;
  }

  const redis = getRedis();
  const nowMs = Date.now();

  let result: unknown;
  try {
    result = await runBidScript(
      redis,
      roomId,
      activeItemId,
      user.id,
      user.name,
      amount,
      meta.minIncrement,
      nowMs,
    );
  } catch (err) {
    console.error("[bids] script eval failed:", err);
    ack({ ok: false, error: { message: "internal error", reason: "INTERNAL_ERROR" } });
    return;
  }

  const typed = result as
    | ["ok", string, string, string, string, string]
    | ["error", BidRejectReason, string, string, string, string];

  if (typed[0] === "error") {
    const reason = typed[1];
    let message = "bid rejected";
    if (reason === "BID_TOO_LOW" && typed[2]) {
      message = `minimum next bid is ${typed[2]}`;
    } else if (reason === "INSUFFICIENT_BUDGET") {
      message = "you don't have enough budget available for that bid";
    } else if (reason === "ROOM_PAUSED") {
      message = "the auction is paused";
    } else if (reason === "ITEM_NOT_ACTIVE") {
      message = "no item is currently active";
    } else if (reason === "TIMER_EXPIRED") {
      message = "the timer has expired for this item";
    } else if (reason === "AUCTIONEER_CANNOT_BID") {
      message = "auctioneers cannot bid";
    } else if (reason === "NOT_AUTHENTICATED") {
      message = "you are not registered as a bidder in this room";
    } else if (reason === "ALREADY_HIGH_BIDDER") {
      message = "you are already the highest bidder — wait for someone to outbid you";
    } else if (reason === "RATE_LIMITED") {
      message = `please wait ${BID_COOLDOWN_MS}ms between bids`;
    }
    ack({ ok: false, error: { message, reason } });
    return;
  }

  const highBidJson = typed[5];
  const highBid = highBidJson ? (JSON.parse(highBidJson) as LiveBid) : null;

  const biddersJson = await redis.hgetall(biddersKey(roomId));
  const bidders: RoomParticipant[] = Object.values(biddersJson).map((json) =>
    JSON.parse(json) as RoomParticipant,
  );

  io.to(roomId).emit(ServerEvent.BID_ACCEPTED, {
    roomId,
    itemId: activeItemId,
    bid: highBid,
    bidders,
  });
  io.to(roomId).emit(ServerEvent.ITEM_STATE_UPDATE, {
    itemId: activeItemId,
    patch: { highBid },
  });

  ack({ ok: true, data: { highBid, bidders } });

  await withDbRetry(() => persistBidToPostgres(roomId, activeItemId, user.id, amount)).catch((err) => {
    console.error(`[placeBid] failed to persist bid to postgres: roomId=${roomId} itemId=${activeItemId} userId=${user.id} amount=${amount}:`, err);
  });
  if (typed[2] && typed[2] !== "") {
    await withDbRetry(() => syncReservedToPostgres(roomId, user.id, amount, typed[2])).catch((err) => {
      console.error(`[placeBid] failed to sync reserved to postgres: roomId=${roomId} userId=${user.id}:`, err);
    });
  }
}

async function persistBidToPostgres(
  roomId: string,
  itemId: string,
  userId: string,
  amount: number,
): Promise<void> {
  await prisma.bid.create({
    data: { roomId, itemId, userId, amount },
  });
}

async function syncReservedToPostgres(
  roomId: string,
  newBidderId: string,
  newReserved: number,
  previousBidderId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.roomParticipant.update({
      where: { roomId_userId: { roomId, userId: previousBidderId } },
      data: { reserved: 0 },
    });
    await tx.roomParticipant.update({
      where: { roomId_userId: { roomId, userId: newBidderId } },
      data: { reserved: newReserved },
    });
  });
}