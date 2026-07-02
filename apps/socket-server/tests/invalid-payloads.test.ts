import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, testRedisRef } = vi.hoisted(() => ({
  mockPrisma: {
    room: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    auctionItem: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    roomParticipant: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    bid: { create: vi.fn(), count: vi.fn() },
    winner: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  testRedisRef: { current: null as any },
}));

vi.mock("../src/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../src/redis.js", () => ({
  getRedis: () => testRedisRef.current,
  closeRedis: vi.fn(),
}));
vi.mock("../src/keys.js", () => ({
  roomKey: (r: string) => `auction:room:${r}`,
  biddersKey: (r: string) => `auction:room:${r}:bidders`,
  itemKey: (r: string, i: string) => `auction:room:${r}:item:${i}`,
  resolvedListKey: (r: string) => `auction:room:${r}:resolved`,
  spectatorsKey: (r: string) => `auction:room:${r}:spectators`,
  presenceKey: (r: string) => `auction:room:${r}:presence`,
}));
vi.mock("@auction/shared", () => ({
  ServerEvent: { BID_ACCEPTED: "bid:accepted", ITEM_STATE_UPDATE: "room:item:state" },
  AUCTION_ROOM: { AUTO_ADVANCE_COOLDOWN_SECONDS: 5, MAX_BIDDERS: 6, MIN_BIDDERS_TO_START: 1 },
}));

import { placeBid, clearBidRateLimit } from "../src/bids.js";

function makeSocket(userId = "u1", roomId = "r1") {
  return { data: { user: { id: userId, name: "Alice", role: "BIDDER" }, roomId } };
}

function makeIo() {
  return { to: () => ({ emit: () => {} }) };
}

function makeAck() {
  const captured: unknown[] = [];
  const ack = (r: unknown) => { captured.push(r); };
  (ack as any)._captured = captured;
  return ack;
}

function setupRedis() {
  testRedisRef.current = {
    hget: vi.fn(() => "active-item-1"),
    hgetall: vi.fn(() => ({})),
    eval: vi.fn(() => ["error", "NOT_AUTHENTICATED", "", "", "", ""]),
  };
}

describe("Invalid Socket Payloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearBidRateLimit("u1");
    setupRedis();
    mockPrisma.room.findUnique.mockResolvedValue({
      id: "r1", code: "ABC", status: "AUCTION", auctioneerId: "other",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
  });

  it("should reject null payload", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, null, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false });
  });

  it("should reject undefined payload", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, undefined, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false });
  });

  it("should reject empty object payload", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, {}, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "BID_TOO_LOW" } });
  });

  it("should reject payload with missing amount field", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, { roomId: "r1" }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "BID_TOO_LOW" } });
  });

  it("should reject payload with amount as string", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, { amount: "500" }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "BID_TOO_LOW" } });
  });

  it("should reject payload with amount as float", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, { amount: 500.5 }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "BID_TOO_LOW" } });
  });

  it("should reject payload with amount = 0", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, { amount: 0 }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "BID_TOO_LOW" } });
  });

  it("should reject payload with negative amount", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, { amount: -100 }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "BID_TOO_LOW" } });
  });

  it("should reject payload with extremely large amount", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, { amount: Number.MAX_SAFE_INTEGER + 1 }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false });
  });

  it("should reject payload with amount as boolean true", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, { amount: true }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "BID_TOO_LOW" } });
  });

  it("should reject payload with amount as null", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, { amount: null }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "BID_TOO_LOW" } });
  });

  it("should reject payload with amount as object", async () => {
    const ack = makeAck();
    await placeBid(makeIo() as any, makeSocket() as any, { amount: { value: 500 } }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "BID_TOO_LOW" } });
  });

  it("should reject bid from unauthenticated socket (no user)", async () => {
    const ack = makeAck();
    const socket = { data: { roomId: "r1" } };
    await placeBid(makeIo() as any, socket as any, { amount: 500 }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "NOT_AUTHENTICATED" } });
  });

  it("should reject bid from socket with no roomId", async () => {
    const ack = makeAck();
    const socket = { data: { user: { id: "u1", name: "Alice", role: "BIDDER" } } };
    await placeBid(makeIo() as any, socket as any, { amount: 500 }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "NOT_AUTHENTICATED" } });
  });

  it("should reject bid from auctioneer", async () => {
    const ack = makeAck();
    const socket = { data: { user: { id: "auc1", name: "Auc", role: "AUCTIONEER" }, roomId: "r1" } };
    mockPrisma.room.findUnique.mockResolvedValue({
      id: "r1", code: "ABC", status: "AUCTION", auctioneerId: "auc1",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    await placeBid(makeIo() as any, socket as any, { amount: 500 }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "AUCTIONEER_CANNOT_BID" } });
  });

  it("should reject bid when room is not in AUCTION status", async () => {
    const ack = makeAck();
    mockPrisma.room.findUnique.mockResolvedValue({
      id: "r1", code: "ABC", status: "LOBBY", auctioneerId: "other",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    await placeBid(makeIo() as any, makeSocket() as any, { amount: 500 }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "ROOM_NOT_AUCTION" } });
  });

  it("should reject bid when room does not exist", async () => {
    const ack = makeAck();
    mockPrisma.room.findUnique.mockResolvedValue(null);
    await placeBid(makeIo() as any, makeSocket() as any, { amount: 500 }, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "INTERNAL_ERROR" } });
  });

  it("should rate-limit rapid bids from the same user", async () => {
    const ack1 = makeAck();
    const ack2 = makeAck();
    testRedisRef.current.eval = vi.fn(() => ["ok", "500", "", "{}", "", "{}"]);

    await placeBid(makeIo() as any, makeSocket() as any, { amount: 500 }, ack1 as any);
    await placeBid(makeIo() as any, makeSocket() as any, { amount: 600 }, ack2 as any);

    expect((ack1 as any)._captured[0]).toMatchObject({ ok: true });
    expect((ack2 as any)._captured[0]).toMatchObject({ ok: false, error: { reason: "RATE_LIMITED" } });
  });

  it("should not crash on deeply nested payload", async () => {
    const ack = makeAck();
    const deep = { a: { b: { c: { d: { amount: 500 } } } } };
    await placeBid(makeIo() as any, makeSocket() as any, deep, ack as any);
    expect((ack as any)._captured[0]).toMatchObject({ ok: false });
  });
});
