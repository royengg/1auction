import { describe, it, expect, beforeEach } from "vitest";
import { createMockRedisState, createMockRedis, type MockRedisState } from "./mock-redis";

const ROOM_ID = "room-edge";
const ITEM_ID = "item-edge";
const ITEM_KEY = `auction:room:${ROOM_ID}:item:${ITEM_ID}`;
const BIDDERS_KEY = `auction:room:${ROOM_ID}:bidders`;

function setupActiveItem(state: MockRedisState): void {
  const redis = createMockRedis(state);
  redis.hset(ITEM_KEY,
    "slotIndex", "0",
    "name", "Edge Item",
    "imageUrl", "",
    "startingPrice", "100",
    "status", "ACTIVE",
    "highBidUserId", "",
    "highBidUserName", "",
    "highBidAmount", "0",
    "highBidPlacedAtMs", "0",
    "endsAt", String(Date.now() + 60000),
    "paused", "0",
    "pausedAt", "0",
    "pausedAccumulatedMs", "0",
  );
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

describe("Edge Cases - Invalid Payloads & Boundary Conditions", () => {
  let state: MockRedisState;

  beforeEach(() => {
    state = createMockRedisState();
    setupActiveItem(state);
  });

  it("should reject a bid of 0", () => {
    const redis = createMockRedis(state);
    redis.hset(BIDDERS_KEY, "user-1", JSON.stringify({
      userId: "user-1",
      name: "Alice",
      role: "BIDDER",
      budget: 10000,
      reserved: 0,
      available: 10000,
      spent: 0,
    }));
    const result = simulateBid(state, "user-1", "Alice", 0);
    expect(result[0]).toBe("error");
    expect(result[1]).toBe("BID_TOO_LOW");
  });

  it("should reject a negative bid amount", () => {
    const redis = createMockRedis(state);
    const isoNow = new Date().toISOString();
    const result = redis.eval("", 2, ITEM_KEY, BIDDERS_KEY, "user-1", "Alice", "-100", "100", String(Date.now()), isoNow);
    const typed = result as unknown as string[];
    expect(typed[0]).toBe("error");
  });

  it("should reject a non-integer bid", () => {
    const redis = createMockRedis(state);
    const isoNow = new Date().toISOString();
    const result = redis.eval("", 2, ITEM_KEY, BIDDERS_KEY, "user-1", "Alice", "100.5", "100", String(Date.now()), isoNow);
    const typed = result as unknown as string[];
    expect(typed[0]).toBe("error");
  });

  it("should reject a bid on a non-existent item (empty hash)", () => {
    createMockRedis(state).del(ITEM_KEY);
    const result = simulateBid(state, "user-1", "Alice", 100);
    expect(result[0]).toBe("error");
    expect(result[1]).toBe("ITEM_NOT_ACTIVE");
  });

  it("should reject a bid with empty bidderId", () => {
    const result = simulateBid(state, "", "Anonymous", 100);
    expect(result[0]).toBe("error");
    expect(result[1]).toBe("NOT_AUTHENTICATED");
  });

  it("should reject a bid with empty bidderName (but valid bidderId)", () => {
    const redis = createMockRedis(state);
    redis.hset(BIDDERS_KEY, "user-1", JSON.stringify({
      userId: "user-1",
      name: "Alice",
      role: "BIDDER",
      budget: 10000,
      reserved: 0,
      available: 10000,
      spent: 0,
    }));
    const result = simulateBid(state, "user-1", "", 100);
    expect(result[0]).toBe("ok");
    const itemHash = redis.hgetall(ITEM_KEY);
    expect(itemHash.highBidUserName).toBe("");
  });

  it("should handle an item with endsAt=0 (no timer)", () => {
    createMockRedis(state).hset(ITEM_KEY, "endsAt", "0");
    const redis = createMockRedis(state);
    redis.hset(BIDDERS_KEY, "user-1", JSON.stringify({
      userId: "user-1",
      name: "Alice",
      role: "BIDDER",
      budget: 10000,
      reserved: 0,
      available: 10000,
      spent: 0,
    }));
    const result = simulateBid(state, "user-1", "Alice", 100);
    expect(result[0]).toBe("ok");
  });

  it("should handle consecutive bid rounds without data leakage", () => {
    const redis = createMockRedis(state);

    for (let round = 1; round <= 3; round++) {
      for (let i = 1; i <= 6; i++) {
        redis.hset(BIDDERS_KEY, `user-${i}`, JSON.stringify({
          userId: `user-${i}`,
          name: `Bidder ${i}`,
          role: "BIDDER",
          budget: 10000,
          reserved: 0,
          available: 10000,
          spent: 0,
        }));
      }

      const amount = 100 * round;
      for (let i = 1; i <= 6; i++) {
        simulateBid(state, `user-${i}`, `Bidder ${i}`, amount + i * 100);
      }

      const itemHash = redis.hgetall(ITEM_KEY);
      const highAmount = Number(itemHash.highBidAmount);
      expect(highAmount).toBe(amount + 600);

      redis.hset(ITEM_KEY,
        "status", "ACTIVE",
        "highBidUserId", "",
        "highBidUserName", "",
        "highBidAmount", "0",
        "highBidPlacedAtMs", "0",
      );
    }
  });

  it("should handle a large minIncrement correctly", () => {
    const redis = createMockRedis(state);
    redis.hset(BIDDERS_KEY, "user-1", JSON.stringify({
      userId: "user-1",
      name: "Alice",
      role: "BIDDER",
      budget: 100000,
      reserved: 0,
      available: 100000,
      spent: 0,
    }));
    redis.hset(BIDDERS_KEY, "user-2", JSON.stringify({
      userId: "user-2",
      name: "Bob",
      role: "BIDDER",
      budget: 100000,
      reserved: 0,
      available: 100000,
      spent: 0,
    }));

    simulateBid(state, "user-1", "Alice", 100);
    const result = simulateBid(state, "user-2", "Bob", 500, 5000);
    expect(result[0]).toBe("error");
    expect(result[1]).toBe("BID_TOO_LOW");
    expect(result[2]).toBe("5100");

    const okResult = simulateBid(state, "user-2", "Bob", 5100, 5000);
    expect(okResult[0]).toBe("ok");
  });

  it("should handle very large bid amounts", () => {
    const redis = createMockRedis(state);
    redis.hset(BIDDERS_KEY, "user-1", JSON.stringify({
      userId: "user-1",
      name: "Alice",
      role: "BIDDER",
      budget: 1_000_000_000,
      reserved: 0,
      available: 1_000_000_000,
      spent: 0,
    }));

    const result = simulateBid(state, "user-1", "Alice", 999_999_999);
    expect(result[0]).toBe("ok");
  });
});
