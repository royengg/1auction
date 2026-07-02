import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRedisState, createMockRedis, type MockRedisState } from "./mock-redis";

let testState: MockRedisState;
let testRedis: ReturnType<typeof createMockRedis>;

const mockPrisma = {
  room: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  auctionItem: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  roomParticipant: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  bid: { create: vi.fn(), count: vi.fn() },
  winner: { findMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("../src/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../src/redis.js", () => ({ getRedis: () => testRedis, closeRedis: vi.fn() }));
vi.mock("../src/keys.js", () => ({
  roomKey: (r: string) => `auction:room:${r}`,
  biddersKey: (r: string) => `auction:room:${r}:bidders`,
  itemKey: (r: string, i: string) => `auction:room:${r}:item:${i}`,
  resolvedListKey: (r: string) => `auction:room:${r}:resolved`,
  spectatorsKey: (r: string) => `auction:room:${r}:spectators`,
  presenceKey: (r: string) => `auction:room:${r}:presence`,
}));
vi.mock("@auction/shared", () => ({
  ServerEvent: {
    ROOM_STATUS_CHANGED: "room:status:changed",
    ACTIVE_ITEM_CHANGED: "room:activeItem:changed",
    ITEM_STATE_UPDATE: "room:item:state",
    ITEM_RESOLVED: "room:item:resolved",
  },
  AUCTION_ROOM: { AUTO_ADVANCE_COOLDOWN_SECONDS: 5, MAX_BIDDERS: 6, MIN_BIDDERS_TO_START: 1 },
}));

const R = "room-restart";
const RK = `auction:room:${R}`;
const IK = `${RK}:item:item-1`;
const BK = `${RK}:bidders`;

function seedActive(): void {
  const r = testRedis;
  r.hset(RK, "status", "AUCTION", "auctioneerId", "auc1", "activeItemId", "item-1", "perRoomBudget", "10000", "minIncrement", "100", "itemDurationSeconds", "60");
  r.hset(IK, "slotIndex", "0", "name", "I1", "imageUrl", "", "startingPrice", "100", "status", "ACTIVE", "highBidUserId", "u1", "highBidUserName", "Alice", "highBidAmount", "500", "highBidPlacedAtMs", "1000", "endsAt", String(Date.now() + 30000), "paused", "0", "pausedAt", "0", "pausedAccumulatedMs", "0");
  r.hset(BK, "u1", JSON.stringify({ userId: "u1", name: "Alice", role: "BIDDER", budget: 10000, reserved: 500, available: 9500, spent: 0 }));
}

function makeIo(): unknown {
  const emitted: { event: string; data: unknown }[] = [];
  return {
    to: () => ({
      emit: (event: string, data: unknown) => { emitted.push({ event, data }); },
    }),
    _emitted: emitted,
  };
}

describe("Restart Recovery - rescheduleAllTimers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState = createMockRedisState();
    testRedis = createMockRedis(testState);
  });

  it("should reschedule timer for active auction with unexpired item", async () => {
    seedActive();
    mockPrisma.room.findMany.mockResolvedValue([{ id: R }]);
    mockPrisma.room.findUnique.mockResolvedValue({
      id: R, code: "ABCD", status: "AUCTION", auctioneerId: "auc1",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: "item-1", roomId: R, slotIndex: 0, name: "I1", description: "", imageUrl: null, startingPrice: 100, status: "ACTIVE", winnerId: null, winningBid: null },
    ]);

    const { rescheduleAllTimers, disposeTimer } = await import("../src/timer.js");
    const io = makeIo();
    await rescheduleAllTimers(io as any);

    const status = testRedis.hget(RK, "status");
    expect(status).toBe("AUCTION");

    disposeTimer(R);
  });

  it("should resolve expired item on restart", async () => {
    seedActive();
    testRedis.hset(IK, "endsAt", String(Date.now() - 5000));
    mockPrisma.room.findMany.mockResolvedValue([{ id: R }]);
    mockPrisma.room.findUnique.mockResolvedValue({
      id: R, code: "ABCD", status: "AUCTION", auctioneerId: "auc1",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: "item-1", roomId: R, slotIndex: 0, name: "I1", description: "", imageUrl: null, startingPrice: 100, status: "ACTIVE", winnerId: null, winningBid: null },
    ]);
    mockPrisma.auctionItem.update.mockResolvedValue({});
    mockPrisma.winner.upsert.mockResolvedValue({});
    mockPrisma.roomParticipant.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

    const { rescheduleAllTimers, disposeTimer } = await import("../src/timer.js");
    const io = makeIo();
    await rescheduleAllTimers(io as any);

    const itemStatus = testRedis.hget(IK, "status");
    expect(itemStatus).toBe("SOLD");

    disposeTimer(R);
  });

  it("should not double-resolve an already resolved item on restart", async () => {
    seedActive();
    testRedis.hset(IK, "endsAt", String(Date.now() - 5000));
    testRedis.hset(IK, "status", "SOLD");
    testRedis.rpush(`${RK}:resolved`, JSON.stringify({ itemId: "item-1", status: "SOLD", winnerId: "u1", winningBid: 500, resolvedAt: new Date().toISOString(), slotIndex: 0, name: "I1" }));
    mockPrisma.room.findMany.mockResolvedValue([{ id: R }]);
    mockPrisma.room.findUnique.mockResolvedValue({
      id: R, code: "ABCD", status: "AUCTION", auctioneerId: "auc1",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: "item-1", roomId: R, slotIndex: 0, name: "I1", description: "", imageUrl: null, startingPrice: 100, status: "SOLD", winnerId: "u1", winningBid: 500 },
    ]);

    const { rescheduleAllTimers, disposeTimer } = await import("../src/timer.js");
    const io = makeIo();
    await rescheduleAllTimers(io as any);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();

    const bidder = JSON.parse(testRedis.hget(BK, "u1")!);
    expect(bidder.spent).toBe(0);

    disposeTimer(R);
  });

  it("should complete room if all items resolved on restart", async () => {
    seedActive();
    testRedis.hset(IK, "status", "SOLD");
    testRedis.hset(RK, "activeItemId", "");
    mockPrisma.room.findMany.mockResolvedValue([{ id: R }]);
    mockPrisma.room.findUnique.mockResolvedValue({
      id: R, code: "ABCD", status: "AUCTION", auctioneerId: "auc1",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: "item-1", roomId: R, slotIndex: 0, name: "I1", description: "", imageUrl: null, startingPrice: 100, status: "SOLD", winnerId: "u1", winningBid: 500 },
    ]);
    mockPrisma.room.update.mockResolvedValue({});

    const { rescheduleAllTimers, disposeTimer } = await import("../src/timer.js");
    const io = makeIo();
    await rescheduleAllTimers(io as any);

    const status = testRedis.hget(RK, "status");
    expect(status).toBe("COMPLETED");

    disposeTimer(R);
  });

  it("should skip paused items on restart", async () => {
    seedActive();
    testRedis.hset(IK, "paused", "1");
    mockPrisma.room.findMany.mockResolvedValue([{ id: R }]);
    mockPrisma.room.findUnique.mockResolvedValue({
      id: R, code: "ABCD", status: "AUCTION", auctioneerId: "auc1",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: "item-1", roomId: R, slotIndex: 0, name: "I1", description: "", imageUrl: null, startingPrice: 100, status: "ACTIVE", winnerId: null, winningBid: null },
    ]);

    const { rescheduleAllTimers, disposeTimer } = await import("../src/timer.js");
    const io = makeIo();
    await rescheduleAllTimers(io as any);

    const itemStatus = testRedis.hget(IK, "status");
    expect(itemStatus).toBe("ACTIVE");
    expect(testRedis.hget(IK, "paused")).toBe("1");

    disposeTimer(R);
  });

  it("should handle room with no active item on restart (advance to next)", async () => {
    seedActive();
    testRedis.hset(RK, "activeItemId", "");
    mockPrisma.room.findMany.mockResolvedValue([{ id: R }]);
    mockPrisma.room.findUnique.mockResolvedValue({
      id: R, code: "ABCD", status: "AUCTION", auctioneerId: "auc1",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: "item-1", roomId: R, slotIndex: 0, name: "I1", description: "", imageUrl: null, startingPrice: 100, status: "PENDING", winnerId: null, winningBid: null },
    ]);
    mockPrisma.auctionItem.updateMany.mockResolvedValue({});
    mockPrisma.room.update.mockResolvedValue({});

    const { rescheduleAllTimers, disposeTimer } = await import("../src/timer.js");
    const io = makeIo();
    await rescheduleAllTimers(io as any);

    disposeTimer(R);
  });
});
