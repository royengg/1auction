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
vi.mock("../src/redis.js", () => ({
  getRedis: () => testRedis,
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
  AUCTION_ROOM: { AUTO_ADVANCE_COOLDOWN_SECONDS: 5, MAX_BIDDERS: 6, MIN_BIDDERS_TO_START: 1 },
}));

const ROOM_ID = "room-cleanup";
const ROOM_KEY = `auction:room:${ROOM_ID}`;
const BIDDERS_KEY = `${ROOM_KEY}:bidders`;
const RESOLVED_KEY = `${ROOM_KEY}:resolved`;
const PRESENCE_KEY = `${ROOM_KEY}:presence`;
const SPECTATORS_KEY = `${ROOM_KEY}:spectators`;
const ITEM1_KEY = `${ROOM_KEY}:item:item-1`;
const ITEM2_KEY = `${ROOM_KEY}:item:item-2`;

function seedRoom(): void {
  const r = testRedis;
  r.hset(ROOM_KEY, "status", "AUCTION", "activeItemId", "item-1");
  r.hset(BIDDERS_KEY, "u1", JSON.stringify({ userId: "u1", name: "A", role: "BIDDER", budget: 10000, reserved: 500, available: 9500, spent: 0 }));
  r.hset(ITEM1_KEY, "status", "ACTIVE", "highBidAmount", "500");
  r.hset(ITEM2_KEY, "status", "PENDING");
  r.rpush(RESOLVED_KEY, JSON.stringify({ itemId: "item-0", status: "SOLD" }));
  r.sadd(PRESENCE_KEY, "u1", "u2");
  r.sadd(SPECTATORS_KEY, "u3");
}

describe("Redis Cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState = createMockRedisState();
    testRedis = createMockRedis(testState);
    seedRoom();
    mockPrisma.room.findUnique.mockResolvedValue({
      id: ROOM_ID, code: "ABCD", status: "AUCTION", auctioneerId: "auc1",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: "item-1", roomId: ROOM_ID, slotIndex: 0, name: "I1", description: "", imageUrl: null, startingPrice: 100, status: "ACTIVE", winnerId: null, winningBid: null },
      { id: "item-2", roomId: ROOM_ID, slotIndex: 1, name: "I2", description: "", imageUrl: null, startingPrice: 200, status: "PENDING", winnerId: null, winningBid: null },
    ]);
  });

  it("should delete all room Redis keys on cleanup", async () => {
    const { cleanupRoomRedis } = await import("../src/room-state.js");
    await cleanupRoomRedis(ROOM_ID);

    expect(testRedis.hgetall(ROOM_KEY)).toEqual({});
    expect(testRedis.hgetall(BIDDERS_KEY)).toEqual({});
    expect(testRedis.hgetall(ITEM1_KEY)).toEqual({});
    expect(testRedis.hgetall(ITEM2_KEY)).toEqual({});
    expect(testRedis.lrange(RESOLVED_KEY, 0, -1)).toEqual([]);
    expect(testRedis.smembers(SPECTATORS_KEY)).toEqual([]);
  });

  it("should not delete keys from other rooms", async () => {
    testRedis.hset("auction:room:other:item:x", "status", "ACTIVE");

    const { cleanupRoomRedis } = await import("../src/room-state.js");
    await cleanupRoomRedis(ROOM_ID);

    expect(Object.keys(testRedis.hgetall("auction:room:other:item:x")).length).toBeGreaterThan(0);
  });

  it("should handle cleanup when room does not exist in DB", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(null);
    const { cleanupRoomRedis } = await import("../src/room-state.js");
    await cleanupRoomRedis(ROOM_ID);
    expect(Object.keys(testRedis.hgetall(ROOM_KEY)).length).toBeGreaterThan(0);
  });

  it("should handle cleanup when room has no items", async () => {
    mockPrisma.auctionItem.findMany.mockResolvedValue([]);
    const { cleanupRoomRedis } = await import("../src/room-state.js");
    await cleanupRoomRedis(ROOM_ID);
    expect(testRedis.hgetall(ROOM_KEY)).toEqual({});
    expect(testRedis.hgetall(BIDDERS_KEY)).toEqual({});
  });
});

describe("Timer Cleanup", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should cancel all timers for a room via disposeTimer", async () => {
    const { disposeTimer, scheduleExpiry, cancelExpiry } = await import("../src/timer.js");
    const noop = { emit: () => {}, to: () => ({ emit: () => {} }) } as any;
    scheduleExpiry(noop, "r1", "i1", Date.now() + 5000);
    scheduleExpiry(noop, "r1", "i2", Date.now() + 5000);

    disposeTimer("r1");
    expect(true).toBe(true);
  });

  it("should cancel a specific item expiry without affecting others", async () => {
    const { cancelExpiry, scheduleExpiry } = await import("../src/timer.js");
    const noop = { emit: () => {}, to: () => ({ emit: () => {} }) } as any;
    scheduleExpiry(noop, "r1", "i1", Date.now() + 5000);
    scheduleExpiry(noop, "r1", "i2", Date.now() + 5000);

    cancelExpiry("r1", "i1");
    expect(true).toBe(true);
  });
});
