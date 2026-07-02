import { describe, it, expect, beforeEach } from "vitest";
import { createMockRedisState, createMockRedis, type MockRedisState } from "./mock-redis";
import type { RoomParticipant } from "@auction/shared";

const ROOM_ID = "room-timer";
const ITEM_ID = "item-timer";
const ITEM_KEY = `auction:room:${ROOM_ID}:item:${ITEM_ID}`;
const BIDDERS_KEY = `auction:room:${ROOM_ID}:bidders`;

function makeBidder(userId: string, name: string, available = 10000): RoomParticipant {
  return { userId, name, role: "BIDDER", budget: 10000, reserved: 0, available, spent: 0 };
}

function setupItem(state: MockRedisState, endsAt: number): void {
  createMockRedis(state).hset(ITEM_KEY,
    "slotIndex", "0",
    "name", "Timer Item",
    "imageUrl", "",
    "startingPrice", "100",
    "status", "ACTIVE",
    "highBidUserId", "",
    "highBidUserName", "",
    "highBidAmount", "0",
    "highBidPlacedAtMs", "0",
    "endsAt", String(endsAt),
    "paused", "0",
    "pausedAt", "0",
    "pausedAccumulatedMs", "0",
  );
}

function bid(state: MockRedisState, userId: string, name: string, amount: number, nowMs: number, minIncrement = 100): string[] {
  const redis = createMockRedis(state);
  const isoNow = new Date(nowMs).toISOString();
  return redis.eval("", 2, ITEM_KEY, BIDDERS_KEY, userId, name, String(amount), String(minIncrement), String(nowMs), isoNow) as unknown as string[];
}

describe("Timer Boundary Conditions", () => {
  let state: MockRedisState;

  beforeEach(() => {
    state = createMockRedisState();
  });

  it("should accept a bid 1ms before expiry", () => {
    const endsAt = 100000;
    setupItem(state, endsAt);
    createMockRedis(state).hset(BIDDERS_KEY, "user-1", JSON.stringify(makeBidder("user-1", "Alice")));

    const result = bid(state, "user-1", "Alice", 100, endsAt - 1);
    expect(result[0]).toBe("ok");
  });

  it("should reject a bid exactly at expiry (endsAt == nowMs)", () => {
    const endsAt = 100000;
    setupItem(state, endsAt);
    createMockRedis(state).hset(BIDDERS_KEY, "user-1", JSON.stringify(makeBidder("user-1", "Alice")));

    const result = bid(state, "user-1", "Alice", 100, endsAt);
    expect(result[0]).toBe("error");
    expect(result[1]).toBe("TIMER_EXPIRED");
  });

  it("should reject a bid 1ms after expiry", () => {
    const endsAt = 100000;
    setupItem(state, endsAt);
    createMockRedis(state).hset(BIDDERS_KEY, "user-1", JSON.stringify(makeBidder("user-1", "Alice")));

    const result = bid(state, "user-1", "Alice", 100, endsAt + 1);
    expect(result[0]).toBe("error");
    expect(result[1]).toBe("TIMER_EXPIRED");
  });

  it("should reject a bid far after expiry", () => {
    const endsAt = 100000;
    setupItem(state, endsAt);
    createMockRedis(state).hset(BIDDERS_KEY, "user-1", JSON.stringify(makeBidder("user-1", "Alice")));

    const result = bid(state, "user-1", "Alice", 100, endsAt + 60000);
    expect(result[0]).toBe("error");
    expect(result[1]).toBe("TIMER_EXPIRED");
  });

  it("should accept bids when endsAt is 0 (no timer)", () => {
    setupItem(state, 0);
    createMockRedis(state).hset(BIDDERS_KEY, "user-1", JSON.stringify(makeBidder("user-1", "Alice")));

    const result = bid(state, "user-1", "Alice", 100, Date.now());
    expect(result[0]).toBe("ok");
  });

  it("should accept a bid just before expiry then reject one at expiry", () => {
    const endsAt = 100000;
    setupItem(state, endsAt);
    createMockRedis(state).hset(BIDDERS_KEY, "user-1", JSON.stringify(makeBidder("user-1", "Alice")));
    createMockRedis(state).hset(BIDDERS_KEY, "user-2", JSON.stringify(makeBidder("user-2", "Bob")));

    const r1 = bid(state, "user-1", "Alice", 100, endsAt - 1);
    expect(r1[0]).toBe("ok");

    const r2 = bid(state, "user-2", "Bob", 300, endsAt);
    expect(r2[0]).toBe("error");
    expect(r2[1]).toBe("TIMER_EXPIRED");
  });

  it("should not allow a bid and resolution to both succeed for the same item", () => {
    const endsAt = 100000;
    setupItem(state, endsAt);
    createMockRedis(state).hset(BIDDERS_KEY, "user-1", JSON.stringify(makeBidder("user-1", "Alice")));

    const bidResult = bid(state, "user-1", "Alice", 100, endsAt - 1);
    expect(bidResult[0]).toBe("ok");

    createMockRedis(state).hset(ITEM_KEY, "status", "SOLD");

    const lateBid = bid(state, "user-2", "Bob", 300, endsAt + 100);
    expect(lateBid[0]).toBe("error");
    expect(lateBid[1]).toBe("ITEM_NOT_ACTIVE");
  });

  it("should reject a bid when endsAt is negative", () => {
    setupItem(state, -1);
    createMockRedis(state).hset(BIDDERS_KEY, "user-1", JSON.stringify(makeBidder("user-1", "Alice")));

    const result = bid(state, "user-1", "Alice", 100, 100);
    expect(result[0]).toBe("ok");
  });
});
