import { describe, it, expect, beforeEach } from "vitest";
import { createMockRedisState, createMockRedis, type MockRedisState } from "./mock-redis";
import type { RoomParticipant } from "@auction/shared";

const ROOM_ID = "room-concurrent";
const ITEM_ID = "item-concurrent";
const ITEM_KEY = `auction:room:${ROOM_ID}:item:${ITEM_ID}`;
const BIDDERS_KEY = `auction:room:${ROOM_ID}:bidders`;

function makeBidder(
  userId: string,
  name: string,
  available = 10000,
): RoomParticipant {
  return {
    userId,
    name,
    role: "BIDDER",
    budget: 10000,
    reserved: 0,
    available,
    spent: 0,
  };
}

function setupRoom(state: MockRedisState, startingPrice = 100, duration = 60000): void {
  const redis = createMockRedis(state);
  redis.hset(ITEM_KEY,
    "slotIndex", "0",
    "name", "Concurrent Item",
    "imageUrl", "",
    "startingPrice", String(startingPrice),
    "status", "ACTIVE",
    "highBidUserId", "",
    "highBidUserName", "",
    "highBidAmount", "0",
    "highBidPlacedAtMs", "0",
    "endsAt", String(Date.now() + duration),
    "paused", "0",
    "pausedAt", "0",
    "pausedAccumulatedMs", "0",
  );

  for (let i = 1; i <= 6; i++) {
    const bidder = makeBidder(`user-${i}`, `Bidder ${i}`);
    redis.hset(BIDDERS_KEY, bidder.userId, JSON.stringify(bidder));
  }
}

function simulateBid(
  state: MockRedisState,
  bidderId: string,
  bidderName: string,
  amount: number,
  minIncrement = 100,
  nowMs = Date.now(),
): string[] {
  const redis = createMockRedis(state);
  const isoNow = new Date(nowMs).toISOString();
  const result = redis.eval("", 2, ITEM_KEY, BIDDERS_KEY, bidderId, bidderName, String(amount), String(minIncrement), String(nowMs), isoNow);
  return result as unknown as string[];
}

describe("Concurrent Bid Simulation - 6 Bidders", () => {
  let state: MockRedisState;

  beforeEach(() => {
    state = createMockRedisState();
    setupRoom(state);
  });

  it("should have exactly one highest bidder after simultaneous bids", () => {
    const bids = [
      { userId: "user-1", name: "Bidder 1", amount: 100 },
      { userId: "user-2", name: "Bidder 2", amount: 200 },
      { userId: "user-3", name: "Bidder 3", amount: 300 },
      { userId: "user-4", name: "Bidder 4", amount: 400 },
      { userId: "user-5", name: "Bidder 5", amount: 500 },
      { userId: "user-6", name: "Bidder 6", amount: 600 },
    ];

    const results = bids.map((b) =>
      simulateBid(state, b.userId, b.name, b.amount),
    );

    const okBids = results.filter((r) => r[0] === "ok");
    expect(okBids.length).toBeGreaterThan(0);

    const itemHash = createMockRedis(state).hgetall(ITEM_KEY);
    expect(itemHash.highBidUserId).toBe("user-6");
    expect(itemHash.highBidAmount).toBe("600");
  });

  it("should only have one highest bidder after rapid sequential bids", () => {
    const amounts = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    let lastOkBidder = "";

    for (let i = 0; i < amounts.length; i++) {
      const userId = `user-${(i % 6) + 1}`;
      const name = `Bidder ${(i % 6) + 1}`;
      const result = simulateBid(state, userId, name, amounts[i]);
      if (result[0] === "ok") {
        lastOkBidder = userId;
      }
    }

    const itemHash = createMockRedis(state).hgetall(ITEM_KEY);
    expect(itemHash.highBidUserId).toBe(lastOkBidder);
    expect(Number(itemHash.highBidAmount)).toBe(1000);
  });

  it("should handle spam bids from the same user (rejected as ALREADY_HIGH_BIDDER)", () => {
    simulateBid(state, "user-1", "Bidder 1", 100);
    const result2 = simulateBid(state, "user-1", "Bidder 1", 200);
    expect(result2[0]).toBe("error");
    expect(result2[1]).toBe("ALREADY_HIGH_BIDDER");
  });

  it("should not lose or duplicate budget across multiple bid rounds", () => {
    simulateBid(state, "user-1", "Bidder 1", 100);
    simulateBid(state, "user-2", "Bidder 2", 200);
    simulateBid(state, "user-3", "Bidder 3", 300);
    simulateBid(state, "user-4", "Bidder 4", 400);

    const redis = createMockRedis(state);
    const allBidders = redis.hgetall(BIDDERS_KEY);
    const bidders = Object.values(allBidders).map((j) => JSON.parse(j) as RoomParticipant);

    const totalReserved = bidders.reduce((sum, b) => sum + b.reserved, 0);
    const totalAvailable = bidders.reduce((sum, b) => sum + b.available, 0);
    const totalBudget = bidders.reduce((sum, b) => sum + b.budget, 0);

    expect(totalReserved + totalAvailable).toBe(totalBudget);
    expect(totalReserved).toBe(400);
  });

  it("should handle bids at the exact same timestamp", () => {
    const now = Date.now();
    const bids = [
      { userId: "user-1", name: "Bidder 1", amount: 100 },
      { userId: "user-2", name: "Bidder 2", amount: 100 },
      { userId: "user-3", name: "Bidder 3", amount: 100 },
    ];

    const results = bids.map((b) =>
      simulateBid(state, b.userId, b.name, b.amount, 100, now),
    );

    const okCount = results.filter((r) => r[0] === "ok").length;
    expect(okCount).toBe(1);

    const itemHash = createMockRedis(state).hgetall(ITEM_KEY);
    expect(Number(itemHash.highBidAmount)).toBe(100);
  });

  it("should handle all 6 bidders bidding with max budget", () => {
    for (let i = 1; i <= 6; i++) {
      const result = simulateBid(
        state,
        `user-${i}`,
        `Bidder ${i}`,
        100 + i * 100,
      );
      expect(result[0]).toBe("ok");
    }

    const itemHash = createMockRedis(state).hgetall(ITEM_KEY);
    expect(itemHash.highBidUserId).toBe("user-6");
    expect(Number(itemHash.highBidAmount)).toBe(700);
  });

  it("should reject bids after the item is resolved", () => {
    simulateBid(state, "user-1", "Bidder 1", 100);
    createMockRedis(state).hset(ITEM_KEY, "status", "SOLD");

    const result = simulateBid(state, "user-2", "Bidder 2", 300);
    expect(result[0]).toBe("error");
    expect(result[1]).toBe("ITEM_NOT_ACTIVE");
  });

  it("should handle bidder exhaustion (all budget spent)", () => {
    const bidder: RoomParticipant = makeBidder("user-1", "Bidder 1", 200);
    createMockRedis(state).hset(BIDDERS_KEY, "user-1", JSON.stringify(bidder));

    const result1 = simulateBid(state, "user-1", "Bidder 1", 200);
    expect(result1[0]).toBe("ok");

    const bidderJson = createMockRedis(state).hget(BIDDERS_KEY, "user-1");
    const updated = JSON.parse(bidderJson!) as RoomParticipant;
    expect(updated.available).toBe(0);
    expect(updated.reserved).toBe(200);
  });
});
