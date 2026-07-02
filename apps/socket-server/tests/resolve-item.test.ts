import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RoomParticipant, AuctionItem } from "@auction/shared";
import { createMockRedisState, createMockRedis, type MockRedisState } from "./mock-redis";

const ROOM_ID = "room-race";
const ITEM_ID = "item-race";
const ITEM_KEY = `auction:room:${ROOM_ID}:item:${ITEM_ID}`;
const BIDDERS_KEY = `auction:room:${ROOM_ID}:bidders`;
const RESOLVED_KEY = `auction:room:${ROOM_ID}:resolved`;

let testState: MockRedisState;
let testRedis: ReturnType<typeof createMockRedis>;

const mockPrisma = {
  room: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  auctionItem: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  roomParticipant: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  bid: { create: vi.fn(), count: vi.fn() },
  winner: { findMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

vi.mock("../src/prisma.js", () => ({ prisma: mockPrisma }));

vi.mock("../src/redis.js", () => ({
  getRedis: () => testRedis,
  closeRedis: vi.fn(),
}));

vi.mock("@auction/shared", () => ({
  AUCTION_ROOM: { AUTO_ADVANCE_COOLDOWN_SECONDS: 5, MAX_BIDDERS: 6, MIN_BIDDERS_TO_START: 1 },
}));

vi.mock("../src/keys.js", () => ({
  roomKey: (roomId: string) => `auction:room:${roomId}`,
  biddersKey: (roomId: string) => `auction:room:${roomId}:bidders`,
  itemKey: (roomId: string, itemId: string) => `auction:room:${roomId}:item:${itemId}`,
  resolvedListKey: (roomId: string) => `auction:room:${roomId}:resolved`,
  spectatorsKey: (roomId: string) => `auction:room:${roomId}:spectators`,
  presenceKey: (roomId: string) => `auction:room:${roomId}:presence`,
}));

function makeItem(): AuctionItem {
  return {
    id: ITEM_ID,
    roomId: ROOM_ID,
    slotIndex: 0,
    name: "Race Item",
    description: "",
    imageUrl: null,
    startingPrice: 100,
    status: "ACTIVE",
    winnerId: null,
    winningBid: null,
  };
}

function setupItemWithBid(state: MockRedisState, bidderId = "user-1", amount = 500): void {
  const redis = createMockRedis(state);
  redis.hset(ITEM_KEY,
    "slotIndex", "0",
    "name", "Race Item",
    "imageUrl", "",
    "startingPrice", "100",
    "status", "ACTIVE",
    "highBidUserId", bidderId,
    "highBidUserName", "Alice",
    "highBidAmount", String(amount),
    "highBidPlacedAtMs", String(Date.now()),
    "endsAt", String(Date.now() - 1000),
    "paused", "0",
    "pausedAt", "0",
    "pausedAccumulatedMs", "0",
  );

  const bidder: RoomParticipant = {
    userId: bidderId,
    name: "Alice",
    role: "BIDDER",
    budget: 10000,
    reserved: amount,
    available: 10000 - amount,
    spent: 0,
  };
  redis.hset(BIDDERS_KEY, bidderId, JSON.stringify(bidder));
}

describe("resolveItem - Race Condition Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState = createMockRedisState();
    testRedis = createMockRedis(testState);
    setupItemWithBid(testState);
    mockPrisma.auctionItem.update.mockResolvedValue({});
    mockPrisma.winner.upsert.mockResolvedValue({});
    mockPrisma.roomParticipant.update.mockResolvedValue({});
  });

  it("should not double-charge the winner if resolveItem is called twice", async () => {
    const { resolveItem } = await import("../src/room-state.js");

    await resolveItem(ROOM_ID, makeItem());
    const secondResult = await resolveItem(ROOM_ID, makeItem());

    expect(secondResult.status).toBe("SOLD");
    expect(secondResult.winnerId).toBe("user-1");
    expect(secondResult.winningBid).toBe(500);

    expect(mockPrisma.roomParticipant.update).toHaveBeenCalledTimes(1);

    const bidderJson = testRedis.hget(BIDDERS_KEY, "user-1");
    const bidder = JSON.parse(bidderJson!) as RoomParticipant;
    expect(bidder.spent).toBe(500);
    expect(bidder.reserved).toBe(0);
  });

  it("should not push duplicate resolved items to the list", async () => {
    const { resolveItem } = await import("../src/room-state.js");

    await resolveItem(ROOM_ID, makeItem());
    await resolveItem(ROOM_ID, makeItem());

    const list = testRedis.lrange(RESOLVED_KEY, 0, -1);
    expect(list.length).toBe(1);
  });

  it("should handle resolving an item with no bids (UNSOLD)", async () => {
    testRedis.hset(ITEM_KEY,
      "highBidUserId", "",
      "highBidUserName", "",
      "highBidAmount", "0",
      "highBidPlacedAtMs", "0",
    );

    const { resolveItem } = await import("../src/room-state.js");
    const result = await resolveItem(ROOM_ID, makeItem());

    expect(result.status).toBe("UNSOLD");
    expect(result.winnerId).toBeNull();
    expect(result.winningBid).toBeNull();
    expect(mockPrisma.winner.upsert).not.toHaveBeenCalled();
  });

  it("should mark the item status in Redis as SOLD", async () => {
    const { resolveItem } = await import("../src/room-state.js");
    await resolveItem(ROOM_ID, makeItem());

    const status = testRedis.hget(ITEM_KEY, "status");
    expect(status).toBe("SOLD");
  });

  it("should update winner's spent and reserved in Redis", async () => {
    const { resolveItem } = await import("../src/room-state.js");
    await resolveItem(ROOM_ID, makeItem());

    const bidderJson = testRedis.hget(BIDDERS_KEY, "user-1");
    const bidder = JSON.parse(bidderJson!) as RoomParticipant;
    expect(bidder.spent).toBe(500);
    expect(bidder.reserved).toBe(0);
    expect(bidder.available).toBe(9500);
  });

  it("should handle Prisma transaction failure gracefully", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("DB connection lost"));

    const { resolveItem } = await import("../src/room-state.js");
    const result = await resolveItem(ROOM_ID, makeItem());

    expect(result.status).toBe("SOLD");

    const status = testRedis.hget(ITEM_KEY, "status");
    expect(status).toBe("SOLD");
  });
});
