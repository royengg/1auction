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
    ROOM_STATE: "room:state", PARTICIPANT_UPDATE: "room:participant:update",
    PARTICIPANT_LEFT: "room:participant:left", SPECTATORS_CHANGED: "room:spectators:changed",
    ROOM_STATUS_CHANGED: "room:status:changed", ACTIVE_ITEM_CHANGED: "room:activeItem:changed",
    ITEM_STATE_UPDATE: "room:item:state", ITEM_RESOLVED: "room:item:resolved",
    BID_ACCEPTED: "bid:accepted", BID_REJECTED: "bid:rejected",
    PAUSE_STATE: "auction:pause", CHAT_MESSAGE: "chat:message",
    PRESENCE: "presence", ERROR: "error",
  },
  AUCTION_ROOM: { AUTO_ADVANCE_COOLDOWN_SECONDS: 5, MAX_BIDDERS: 6, MIN_BIDDERS_TO_START: 1 },
}));

const R = "room-presence";
const RK = `auction:room:${R}`;
const BK = `${RK}:bidders`;
const PK = `${RK}:presence`;
const SK = `${RK}:spectators`;
const IK = `${RK}:item:item-1`;

describe("Presence & Reconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState = createMockRedisState();
    testRedis = createMockRedis(testState);
  });

  it("should mark user present on join", async () => {
    const { markPresent, listPresent } = await import("../src/presence.js");
    await markPresent(R, "u1");
    expect(testRedis.smembers(PK)).toContain("u1");
  });

  it("should mark user absent on disconnect", async () => {
    const { markPresent, markAbsent, listPresent } = await import("../src/presence.js");
    await markPresent(R, "u1");
    await markAbsent(R, "u1");
    expect(testRedis.smembers(PK)).not.toContain("u1");
  });

  it("should not affect other users when one disconnects", async () => {
    const { markPresent, markAbsent } = await import("../src/presence.js");
    await markPresent(R, "u1");
    await markPresent(R, "u2");
    await markPresent(R, "u3");
    await markAbsent(R, "u2");
    const present = testRedis.smembers(PK);
    expect(present).toContain("u1");
    expect(present).toContain("u3");
    expect(present).not.toContain("u2");
  });

  it("should handle multiple markPresent for same user (idempotent)", async () => {
    const { markPresent } = await import("../src/presence.js");
    await markPresent(R, "u1");
    await markPresent(R, "u1");
    await markPresent(R, "u1");
    const present = testRedis.smembers(PK);
    expect(present.filter((p) => p === "u1").length).toBe(1);
  });

  it("should handle markAbsent for user not in set (no error)", async () => {
    const { markAbsent } = await import("../src/presence.js");
    await markAbsent(R, "ghost");
    expect(testRedis.smembers(PK)).toEqual([]);
  });

  it("should build correct room snapshot with spectators on reconnect", async () => {
    testRedis.hset(RK, "status", "AUCTION", "auctioneerId", "auc1", "activeItemId", "item-1", "perRoomBudget", "10000", "minIncrement", "100", "itemDurationSeconds", "60");
    testRedis.hset(IK, "slotIndex", "0", "name", "I1", "imageUrl", "", "startingPrice", "100", "status", "ACTIVE", "highBidUserId", "", "highBidUserName", "", "highBidAmount", "0", "highBidPlacedAtMs", "0", "endsAt", "0", "paused", "0", "pausedAt", "0", "pausedAccumulatedMs", "0");
    testRedis.hset(BK, "u1", JSON.stringify({ userId: "u1", name: "Alice", role: "BIDDER", budget: 10000, reserved: 0, available: 10000, spent: 0 }));
    testRedis.sadd(SK, "spec1", "spec2");

    mockPrisma.room.findUnique.mockResolvedValue({
      id: R, code: "ABCD", status: "AUCTION", auctioneerId: "auc1",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: "item-1", roomId: R, slotIndex: 0, name: "I1", description: "", imageUrl: null, startingPrice: 100, status: "ACTIVE", winnerId: null, winningBid: null },
    ]);

    const { buildRoomSnapshot } = await import("../src/room-state.js");
    const snapshot = await buildRoomSnapshot(R);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.spectatorIds).toContain("spec1");
    expect(snapshot!.spectatorIds).toContain("spec2");
    expect(snapshot!.status).toBe("AUCTION");
  });

  it("should return empty spectatorIds when no spectators", async () => {
    testRedis.hset(RK, "status", "AUCTION", "auctioneerId", "auc1", "activeItemId", "item-1", "perRoomBudget", "10000", "minIncrement", "100", "itemDurationSeconds", "60");
    testRedis.hset(IK, "slotIndex", "0", "name", "I1", "imageUrl", "", "startingPrice", "100", "status", "ACTIVE", "highBidUserId", "", "highBidUserName", "", "highBidAmount", "0", "highBidPlacedAtMs", "0", "endsAt", "0", "paused", "0", "pausedAt", "0", "pausedAccumulatedMs", "0");
    testRedis.hset(BK, "u1", JSON.stringify({ userId: "u1", name: "Alice", role: "BIDDER", budget: 10000, reserved: 0, available: 10000, spent: 0 }));

    mockPrisma.room.findUnique.mockResolvedValue({
      id: R, code: "ABCD", status: "AUCTION", auctioneerId: "auc1",
      perRoomBudget: 10000, minIncrement: 100, itemDurationSeconds: 60,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: "item-1", roomId: R, slotIndex: 0, name: "I1", description: "", imageUrl: null, startingPrice: 100, status: "ACTIVE", winnerId: null, winningBid: null },
    ]);

    const { buildRoomSnapshot } = await import("../src/room-state.js");
    const snapshot = await buildRoomSnapshot(R);
    expect(snapshot!.spectatorIds).toEqual([]);
  });

  it("should handle presence TTL refresh on ping", async () => {
    const { markPresent } = await import("../src/presence.js");
    await markPresent(R, "u1");
    await markPresent(R, "u1");
    expect(testRedis.smembers(PK)).toContain("u1");
  });
});
