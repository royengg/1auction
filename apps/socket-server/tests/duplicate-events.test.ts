import { describe, it, expect, beforeEach } from "vitest";
import { createMockRedisState, createMockRedis, type MockRedisState } from "./mock-redis";
import type { RoomParticipant } from "@auction/shared";

const ROOM_ID = "room-dup";
const ITEM_ID = "item-dup";
const ITEM_KEY = `auction:room:${ROOM_ID}:item:${ITEM_ID}`;
const BIDDERS_KEY = `auction:room:${ROOM_ID}:bidders`;

function makeBidder(userId: string, name: string, available = 10000): RoomParticipant {
  return { userId, name, role: "BIDDER", budget: 10000, reserved: 0, available, spent: 0 };
}

function setupItem(state: MockRedisState): void {
  createMockRedis(state).hset(ITEM_KEY,
    "slotIndex", "0", "name", "Dup Item", "imageUrl", "",
    "startingPrice", "100", "status", "ACTIVE",
    "highBidUserId", "", "highBidUserName", "", "highBidAmount", "0",
    "highBidPlacedAtMs", "0",
    "endsAt", String(Date.now() + 60000),
    "paused", "0", "pausedAt", "0", "pausedAccumulatedMs", "0",
  );
}

function bid(state: MockRedisState, userId: string, name: string, amount: number, nowMs = Date.now()): string[] {
  const redis = createMockRedis(state);
  return redis.eval("", 2, ITEM_KEY, BIDDERS_KEY, userId, name, String(amount), "100", String(nowMs), new Date(nowMs).toISOString()) as unknown as string[];
}

describe("Duplicate WebSocket Events & Client Retries", () => {
  let state: MockRedisState;

  beforeEach(() => {
    state = createMockRedisState();
    setupItem(state);
    createMockRedis(state).hset(BIDDERS_KEY, "user-1", JSON.stringify(makeBidder("user-1", "Alice")));
    createMockRedis(state).hset(BIDDERS_KEY, "user-2", JSON.stringify(makeBidder("user-2", "Bob")));
  });

  it("should reject duplicate bid from same user (ALREADY_HIGH_BIDDER)", () => {
    const r1 = bid(state, "user-1", "Alice", 100);
    expect(r1[0]).toBe("ok");

    const r2 = bid(state, "user-1", "Alice", 100);
    expect(r2[0]).toBe("error");
    expect(r2[1]).toBe("ALREADY_HIGH_BIDDER");
  });

  it("should reject duplicate bid with higher amount from same high bidder", () => {
    bid(state, "user-1", "Alice", 100);

    const r = bid(state, "user-1", "Alice", 500);
    expect(r[0]).toBe("error");
    expect(r[1]).toBe("ALREADY_HIGH_BIDDER");
  });

  it("should not create duplicate high bid entries for repeated same-amount bids", () => {
    bid(state, "user-1", "Alice", 100);
    bid(state, "user-1", "Alice", 100);
    bid(state, "user-1", "Alice", 100);

    const item = createMockRedis(state).hgetall(ITEM_KEY);
    expect(item.highBidUserId).toBe("user-1");
    expect(item.highBidAmount).toBe("100");
  });

  it("should handle client retry: same payload sent twice", () => {
    const now = Date.now();
    const r1 = bid(state, "user-1", "Alice", 100, now);
    const r2 = bid(state, "user-1", "Alice", 100, now);

    expect(r1[0]).toBe("ok");
    expect(r2[0]).toBe("error");
    expect(r2[1]).toBe("ALREADY_HIGH_BIDDER");
  });

  it("should handle alternating bids between two users without data loss", () => {
    const amounts = [100, 200, 300, 400, 500];
    let expectedHigh = 0;
    let expectedUser = "";

    for (let i = 0; i < amounts.length; i++) {
      const userId = `user-${(i % 2) + 1}`;
      const name = userId === "user-1" ? "Alice" : "Bob";
      const r = bid(state, userId, name, amounts[i]);
      expect(r[0]).toBe("ok");
      expectedHigh = amounts[i];
      expectedUser = userId;
    }

    const item = createMockRedis(state).hgetall(ITEM_KEY);
    expect(item.highBidUserId).toBe(expectedUser);
    expect(Number(item.highBidAmount)).toBe(expectedHigh);
  });

  it("should not double-reserve budget on duplicate bids", () => {
    bid(state, "user-1", "Alice", 500);
    bid(state, "user-1", "Alice", 500);

    const bidder = JSON.parse(createMockRedis(state).hget(BIDDERS_KEY, "user-1")!);
    expect(bidder.reserved).toBe(500);
    expect(bidder.available).toBe(9500);
  });

  it("should not double-release previous bidder budget on duplicate outbids", () => {
    bid(state, "user-1", "Alice", 500);
    bid(state, "user-2", "Bob", 700);

    const aliceBefore = JSON.parse(createMockRedis(state).hget(BIDDERS_KEY, "user-1")!);
    expect(aliceBefore.reserved).toBe(0);
    expect(aliceBefore.available).toBe(10000);

    bid(state, "user-2", "Bob", 900);

    const aliceAfter = JSON.parse(createMockRedis(state).hget(BIDDERS_KEY, "user-1")!);
    expect(aliceAfter.reserved).toBe(0);
    expect(aliceAfter.available).toBe(10000);
  });
});
