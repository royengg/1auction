import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRedisState, createMockRedis, type MockRedisState } from "./mock-redis";
import type { RoomParticipant } from "@auction/shared";

let testState: MockRedisState;
let testRedis: ReturnType<typeof createMockRedis>;

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    room: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    auctionItem: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    roomParticipant: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    bid: { create: vi.fn(), count: vi.fn() },
    winner: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
  },
}));

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
  AUCTION_ROOM: { AUTO_ADVANCE_COOLDOWN_SECONDS: 5, MAX_BIDDERS: 6, MIN_BIDDERS_TO_START: 1 },
}));

const RI = "room-inv";
const II = "item-inv";
const IK = `auction:room:${RI}:item:${II}`;
const BK = `auction:room:${RI}:bidders`;

function makeBidders(): RoomParticipant[] {
  return [1, 2, 3, 4, 5, 6].map((i) => ({
    userId: `u${i}`, name: `B${i}`, role: "BIDDER" as const,
    budget: 10000, reserved: 0, available: 10000, spent: 0,
  }));
}

function setup(state: MockRedisState): void {
  const r = createMockRedis(state);
  r.hset(IK, "slotIndex", "0", "name", "Inv", "imageUrl", "", "startingPrice", "100", "status", "ACTIVE", "highBidUserId", "", "highBidUserName", "", "highBidAmount", "0", "highBidPlacedAtMs", "0", "endsAt", String(Date.now() + 60000), "paused", "0", "pausedAt", "0", "pausedAccumulatedMs", "0");
  for (const b of makeBidders()) r.hset(BK, b.userId, JSON.stringify(b));
}

function bid(state: MockRedisState, uid: string, name: string, amt: number): string[] {
  const now = Date.now();
  return createMockRedis(state).eval("", 2, IK, BK, uid, name, String(amt), "100", String(now), new Date(now).toISOString()) as unknown as string[];
}

function getBidder(state: MockRedisState, uid: string): RoomParticipant {
  return JSON.parse(createMockRedis(state).hget(BK, uid)!);
}

function getAllBidders(state: MockRedisState): RoomParticipant[] {
  return Object.values(createMockRedis(state).hgetall(BK)).map((j) => JSON.parse(j) as RoomParticipant);
}

describe("State Invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState = createMockRedisState();
    testRedis = createMockRedis(testState);
    setup(testState);
    mockPrisma.auctionItem.update.mockResolvedValue({});
    mockPrisma.winner.upsert.mockResolvedValue({});
    mockPrisma.roomParticipant.update.mockResolvedValue({});
  });

  it("should maintain available + reserved + spent == budget after every bid", () => {
    const sequence = [
      ["u1", "B1", 100], ["u2", "B2", 200], ["u3", "B3", 300],
      ["u4", "B4", 400], ["u5", "B5", 500], ["u6", "B6", 600],
      ["u1", "B1", 700], ["u2", "B2", 800], ["u3", "B3", 900],
    ];
    for (const [uid, name, amt] of sequence) {
      bid(testState, uid, name, Number(amt));
      for (const b of getAllBidders(testState)) {
        expect(b.available + b.reserved + b.spent).toBe(b.budget);
      }
    }
  });

  it("should have exactly one highest bidder at all times", () => {
    bid(testState, "u1", "B1", 100);
    let item = createMockRedis(testState).hgetall(IK);
    expect(item.highBidUserId).toBe("u1");

    bid(testState, "u2", "B2", 300);
    item = createMockRedis(testState).hgetall(IK);
    expect(item.highBidUserId).toBe("u2");
    expect(Number(item.highBidAmount)).toBe(300);
  });

  it("should never produce negative balances", () => {
    for (let round = 0; round < 5; round++) {
      for (let i = 1; i <= 6; i++) {
        bid(testState, `u${i}`, `B${i}`, 100 + round * 100 + i * 100);
      }
    }
    for (const b of getAllBidders(testState)) {
      expect(b.available).toBeGreaterThanOrEqual(0);
      expect(b.reserved).toBeGreaterThanOrEqual(0);
      expect(b.spent).toBeGreaterThanOrEqual(0);
    }
  });

  it("should maintain total budget conservation across all bidders", () => {
    const totalBudget = 6 * 10000;
    for (let i = 1; i <= 6; i++) {
      bid(testState, `u${i}`, `B${i}`, i * 100);
    }
    const all = getAllBidders(testState);
    const totalAvail = all.reduce((s, b) => s + b.available, 0);
    const totalRes = all.reduce((s, b) => s + b.reserved, 0);
    const totalSpent = all.reduce((s, b) => s + b.spent, 0);
    expect(totalAvail + totalRes + totalSpent).toBe(totalBudget);
  });

  it("should release previous bidder funds completely when outbid", () => {
    bid(testState, "u1", "B1", 500);
    expect(getBidder(testState, "u1").reserved).toBe(500);

    bid(testState, "u2", "B2", 700);
    expect(getBidder(testState, "u1").reserved).toBe(0);
    expect(getBidder(testState, "u1").available).toBe(10000);
    expect(getBidder(testState, "u2").reserved).toBe(700);
  });

  it("should maintain invariant through resolveItem (winner)", async () => {
    bid(testState, "u1", "B1", 500);

    const { resolveItem } = await import("../src/room-state.js");
    const item = { id: II, roomId: RI, slotIndex: 0, name: "Inv", description: "", imageUrl: null, startingPrice: 100, status: "ACTIVE" as const, winnerId: null, winningBid: null };
    await resolveItem(RI, item);

    const winner = getBidder(testState, "u1");
    expect(winner.available + winner.reserved + winner.spent).toBe(winner.budget);
    expect(winner.spent).toBe(500);
    expect(winner.reserved).toBe(0);
  });
});
