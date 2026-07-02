import { describe, it, expect, beforeEach } from "vitest";
import { createMockRedisState, createMockRedis, type MockRedisState } from "./mock-redis";
import type { RoomParticipant } from "@auction/shared";

function setupRoom(state: MockRedisState, roomId: string, itemId: string, sp = 100): void {
  const IK = `auction:room:${roomId}:item:${itemId}`;
  const BK = `auction:room:${roomId}:bidders`;
  createMockRedis(state).hset(IK, "slotIndex", "0", "name", `I-${roomId}`, "imageUrl", "", "startingPrice", String(sp), "status", "ACTIVE", "highBidUserId", "", "highBidUserName", "", "highBidAmount", "0", "highBidPlacedAtMs", "0", "endsAt", String(Date.now() + 60000), "paused", "0", "pausedAt", "0", "pausedAccumulatedMs", "0");
  const b: RoomParticipant = { userId: "u1", name: "Alice", role: "BIDDER", budget: 10000, reserved: 0, available: 10000, spent: 0 };
  createMockRedis(state).hset(BK, "u1", JSON.stringify(b));
}

function doBid(state: MockRedisState, roomId: string, itemId: string, uid: string, name: string, amt: number): string[] {
  const IK = `auction:room:${roomId}:item:${itemId}`;
  const BK = `auction:room:${roomId}:bidders`;
  const now = Date.now();
  return createMockRedis(state).eval("", 2, IK, BK, uid, name, String(amt), "100", String(now), new Date(now).toISOString()) as unknown as string[];
}

describe("Multi-Room Isolation", () => {
  let state: MockRedisState;
  beforeEach(() => {
    state = createMockRedisState();
    setupRoom(state, "rA", "iA", 100);
    setupRoom(state, "rB", "iB", 200);
  });

  it("should isolate bids between two rooms", () => {
    expect(doBid(state, "rA", "iA", "u1", "Alice", 100)[0]).toBe("ok");
    expect(doBid(state, "rB", "iB", "u1", "Alice", 200)[0]).toBe("ok");

    const iA = createMockRedis(state).hgetall("auction:room:rA:item:iA");
    const iB = createMockRedis(state).hgetall("auction:room:rB:item:iB");
    expect(iA.highBidAmount).toBe("100");
    expect(iB.highBidAmount).toBe("200");
  });

  it("should isolate bidder budget between rooms", () => {
    doBid(state, "rA", "iA", "u1", "Alice", 500);
    const aA = JSON.parse(createMockRedis(state).hget("auction:room:rA:bidders", "u1")!);
    const aB = JSON.parse(createMockRedis(state).hget("auction:room:rB:bidders", "u1")!);
    expect(aA.reserved).toBe(500);
    expect(aA.available).toBe(9500);
    expect(aB.reserved).toBe(0);
    expect(aB.available).toBe(10000);
  });

  it("should not leak Redis keys between rooms", () => {
    expect(createMockRedis(state).hgetall("auction:room:rA:item:iA")).toBeDefined();
    expect(Object.keys(createMockRedis(state).hgetall("auction:room:rA:item:iB")).length).toBe(0);
    expect(Object.keys(createMockRedis(state).hgetall("auction:room:rB:item:iA")).length).toBe(0);
  });

  it("should resolve items independently per room", () => {
    doBid(state, "rA", "iA", "u1", "Alice", 100);
    createMockRedis(state).hset("auction:room:rA:item:iA", "status", "SOLD");
    const iA = createMockRedis(state).hgetall("auction:room:rA:item:iA");
    const iB = createMockRedis(state).hgetall("auction:room:rB:item:iB");
    expect(iA.status).toBe("SOLD");
    expect(iB.status).toBe("ACTIVE");
  });

  it("should handle 3 rooms with simultaneous bids", () => {
    setupRoom(state, "rC", "iC", 300);
    expect(doBid(state, "rA", "iA", "u1", "Alice", 100)[0]).toBe("ok");
    expect(doBid(state, "rB", "iB", "u1", "Alice", 200)[0]).toBe("ok");
    expect(doBid(state, "rC", "iC", "u1", "Alice", 300)[0]).toBe("ok");

    const totalReserved = ["rA", "rB", "rC"].reduce((sum, r) => {
      const b = JSON.parse(createMockRedis(state).hget(`auction:room:${r}:bidders`, "u1")!);
      return sum + b.reserved;
    }, 0);
    expect(totalReserved).toBe(600);
  });
});
