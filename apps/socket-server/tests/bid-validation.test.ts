import { describe, it, expect, beforeEach } from "vitest";
import { createMockRedisState, createMockRedis, type MockRedisState } from "./mock-redis";
import type { RoomParticipant } from "@auction/shared";

const ROOM_ID = "room-1";
const ITEM_ID = "item-1";
const ITEM_KEY = `auction:room:${ROOM_ID}:item:${ITEM_ID}`;
const BIDDERS_KEY = `auction:room:${ROOM_ID}:bidders`;

function makeBidder(
  userId: string,
  name: string,
  available = 10000,
  reserved = 0,
  spent = 0,
): RoomParticipant {
  return {
    userId,
    name,
    role: "BIDDER",
    budget: 10000,
    reserved,
    available,
    spent,
  };
}

function setupActiveItem(
  state: MockRedisState,
  startingPrice = 100,
  endsAt = Date.now() + 60000,
): void {
  const redis = createMockRedis(state);
  redis.hset(ITEM_KEY,
    "slotIndex", "0",
    "name", "Test Item",
    "imageUrl", "",
    "startingPrice", String(startingPrice),
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

function setupBidder(state: MockRedisState, bidder: RoomParticipant): void {
  const redis = createMockRedis(state);
  redis.hset(BIDDERS_KEY, bidder.userId, JSON.stringify(bidder));
}

function placeBid(
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

describe("Bid Validation - Lua Script Simulation", () => {
  let state: MockRedisState;

  beforeEach(() => {
    state = createMockRedisState();
    setupActiveItem(state);
  });

  describe("Valid bids", () => {
    it("should accept the first bid at starting price", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      const result = placeBid(state, "user-1", "Alice", 100);
      expect(result[0]).toBe("ok");
      expect(result[1]).toBe("100");
      expect(result[2]).toBe("");
    });

    it("should accept a bid above starting price", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      const result = placeBid(state, "user-1", "Alice", 500);
      expect(result[0]).toBe("ok");
      expect(result[1]).toBe("500");
    });

    it("should accept a bid exactly at min increment above current high", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      setupBidder(state, makeBidder("user-2", "Bob"));
      placeBid(state, "user-1", "Alice", 100);
      const result = placeBid(state, "user-2", "Bob", 200);
      expect(result[0]).toBe("ok");
      expect(result[1]).toBe("200");
    });
  });

  describe("Bid too low", () => {
    it("should reject a bid below starting price", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      const result = placeBid(state, "user-1", "Alice", 50);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("BID_TOO_LOW");
      expect(result[2]).toBe("100");
    });

    it("should reject a bid below min increment from current high", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      setupBidder(state, makeBidder("user-2", "Bob"));
      placeBid(state, "user-1", "Alice", 500);
      const result = placeBid(state, "user-2", "Bob", 550);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("BID_TOO_LOW");
      expect(result[2]).toBe("600");
    });

    it("should reject a bid equal to current high (no increment)", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      setupBidder(state, makeBidder("user-2", "Bob"));
      placeBid(state, "user-1", "Alice", 500);
      const result = placeBid(state, "user-2", "Bob", 500);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("BID_TOO_LOW");
    });
  });

  describe("Already high bidder", () => {
    it("should reject a bid from the current high bidder", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      placeBid(state, "user-1", "Alice", 500);
      const result = placeBid(state, "user-1", "Alice", 600);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("ALREADY_HIGH_BIDDER");
    });
  });

  describe("Insufficient budget", () => {
    it("should reject a bid exceeding available budget", () => {
      setupBidder(state, makeBidder("user-1", "Alice", 300));
      const result = placeBid(state, "user-1", "Alice", 500);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("INSUFFICIENT_BUDGET");
    });

    it("should accept a bid equal to available budget", () => {
      setupBidder(state, makeBidder("user-1", "Alice", 500));
      const result = placeBid(state, "user-1", "Alice", 500);
      expect(result[0]).toBe("ok");
    });
  });

  describe("Auctioneer cannot bid", () => {
    it("should reject a bid from the auctioneer", () => {
      const auctioneer: RoomParticipant = {
        ...makeBidder("auctioneer-1", "Auctioneer"),
        role: "AUCTIONEER",
      };
      setupBidder(state, auctioneer);
      const result = placeBid(state, "auctioneer-1", "Auctioneer", 500);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("AUCTIONEER_CANNOT_BID");
    });
  });

  describe("Not authenticated (not in bidders hash)", () => {
    it("should reject a bid from a non-registered user", () => {
      const result = placeBid(state, "ghost-user", "Ghost", 500);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("NOT_AUTHENTICATED");
    });

    it("should reject a bid from a spectator", () => {
      const result = placeBid(state, "spectator-1", "Watcher", 500);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("NOT_AUTHENTICATED");
    });
  });

  describe("Item not active", () => {
    it("should reject a bid when item status is SOLD", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      createMockRedis(state).hset(ITEM_KEY, "status", "SOLD");
      const result = placeBid(state, "user-1", "Alice", 500);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("ITEM_NOT_ACTIVE");
    });

    it("should reject a bid when item status is PENDING", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      createMockRedis(state).hset(ITEM_KEY, "status", "PENDING");
      const result = placeBid(state, "user-1", "Alice", 500);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("ITEM_NOT_ACTIVE");
    });

    it("should reject a bid when item hash is empty", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      createMockRedis(state).del(ITEM_KEY);
      const result = placeBid(state, "user-1", "Alice", 500);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("ITEM_NOT_ACTIVE");
    });
  });

  describe("Room paused", () => {
    it("should reject a bid when the item is paused", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      createMockRedis(state).hset(ITEM_KEY, "paused", "1");
      const result = placeBid(state, "user-1", "Alice", 500);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("ROOM_PAUSED");
    });
  });

  describe("Timer expired", () => {
    it("should reject a bid after the timer expires", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      createMockRedis(state).hset(ITEM_KEY, "endsAt", String(Date.now() - 1000));
      const result = placeBid(state, "user-1", "Alice", 500);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("TIMER_EXPIRED");
    });

    it("should accept a bid exactly at the timer boundary (endsAt == nowMs)", () => {
      const now = Date.now();
      createMockRedis(state).hset(ITEM_KEY, "endsAt", String(now));
      setupBidder(state, makeBidder("user-1", "Alice"));
      const result = placeBid(state, "user-1", "Alice", 500, 100, now);
      expect(result[0]).toBe("error");
      expect(result[1]).toBe("TIMER_EXPIRED");
    });
  });

  describe("Budget reservation on successful bid", () => {
    it("should reserve the bid amount from the bidder's available", () => {
      setupBidder(state, makeBidder("user-1", "Alice", 5000));
      placeBid(state, "user-1", "Alice", 500);
      const bidderJson = createMockRedis(state).hget(BIDDERS_KEY, "user-1");
      const bidder = JSON.parse(bidderJson!) as RoomParticipant;
      expect(bidder.reserved).toBe(500);
      expect(bidder.available).toBe(4500);
    });

    it("should release reserved funds from the previous high bidder", () => {
      setupBidder(state, makeBidder("user-1", "Alice", 5000));
      setupBidder(state, makeBidder("user-2", "Bob", 5000));
      placeBid(state, "user-1", "Alice", 500);
      placeBid(state, "user-2", "Bob", 700);

      const aliceJson = createMockRedis(state).hget(BIDDERS_KEY, "user-1");
      const alice = JSON.parse(aliceJson!) as RoomParticipant;
      expect(alice.reserved).toBe(0);
      expect(alice.available).toBe(5000);

      const bobJson = createMockRedis(state).hget(BIDDERS_KEY, "user-2");
      const bob = JSON.parse(bobJson!) as RoomParticipant;
      expect(bob.reserved).toBe(700);
      expect(bob.available).toBe(4300);
    });

    it("should update the high bid in the item hash", () => {
      setupBidder(state, makeBidder("user-1", "Alice"));
      placeBid(state, "user-1", "Alice", 500);
      const itemHash = createMockRedis(state).hgetall(ITEM_KEY);
      expect(itemHash.highBidUserId).toBe("user-1");
      expect(itemHash.highBidUserName).toBe("Alice");
      expect(itemHash.highBidAmount).toBe("500");
    });
  });
});
