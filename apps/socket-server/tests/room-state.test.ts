import { describe, it, expect, vi } from "vitest";
import type { AuctionItem } from "@auction/shared";

vi.mock("../src/prisma.js", () => ({
  prisma: {
    room: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    auctionItem: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    roomParticipant: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    bid: { create: vi.fn(), count: vi.fn() },
    winner: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/redis.js", () => ({
  getRedis: () => ({}),
  closeRedis: vi.fn(),
}));

vi.mock("@auction/shared", () => ({
  AUCTION_ROOM: { AUTO_ADVANCE_COOLDOWN_SECONDS: 5, MAX_BIDDERS: 6, MIN_BIDDERS_TO_START: 1 },
}));

import { nextItemAfter, allItemsResolved, isFirstItemSlot } from "../src/room-state.js";

function makeItem(
  slotIndex: number,
  status: AuctionItem["status"] = "PENDING",
): AuctionItem {
  return {
    id: `item-${slotIndex}`,
    roomId: "room-1",
    slotIndex,
    name: `Item ${slotIndex}`,
    description: "",
    imageUrl: null,
    startingPrice: 100,
    status,
    winnerId: null,
    winningBid: null,
  };
}

describe("Room State - Pure Functions", () => {
  describe("nextItemAfter", () => {
    it("should return the next PENDING item after the current slot", () => {
      const items = [makeItem(0, "SOLD"), makeItem(1, "PENDING"), makeItem(2, "PENDING")];
      const next = nextItemAfter(items, 0);
      expect(next?.slotIndex).toBe(1);
    });

    it("should skip over SOLD items", () => {
      const items = [makeItem(0, "SOLD"), makeItem(1, "SOLD"), makeItem(2, "PENDING")];
      const next = nextItemAfter(items, 0);
      expect(next?.slotIndex).toBe(2);
    });

    it("should skip over UNSOLD items", () => {
      const items = [makeItem(0, "UNSOLD"), makeItem(1, "PENDING")];
      const next = nextItemAfter(items, 0);
      expect(next?.slotIndex).toBe(1);
    });

    it("should skip over ACTIVE items", () => {
      const items = [makeItem(0, "ACTIVE"), makeItem(1, "PENDING")];
      const next = nextItemAfter(items, 0);
      expect(next?.slotIndex).toBe(1);
    });

    it("should return null when no more PENDING items exist", () => {
      const items = [makeItem(0, "SOLD"), makeItem(1, "UNSOLD")];
      const next = nextItemAfter(items, 0);
      expect(next).toBeNull();
    });

    it("should return null when current slot is the last", () => {
      const items = [makeItem(0, "SOLD"), makeItem(1, "PENDING")];
      const next = nextItemAfter(items, 1);
      expect(next).toBeNull();
    });

    it("should return the first PENDING item when current slot is -1", () => {
      const items = [makeItem(0, "SOLD"), makeItem(1, "PENDING")];
      const next = nextItemAfter(items, -1);
      expect(next?.slotIndex).toBe(1);
    });

    it("should handle empty items array", () => {
      const next = nextItemAfter([], 0);
      expect(next).toBeNull();
    });
  });

  describe("allItemsResolved", () => {
    it("should return true when all items are SOLD", () => {
      const items = [makeItem(0, "SOLD"), makeItem(1, "SOLD")];
      expect(allItemsResolved(items)).toBe(true);
    });

    it("should return true when all items are SOLD or UNSOLD", () => {
      const items = [makeItem(0, "SOLD"), makeItem(1, "UNSOLD")];
      expect(allItemsResolved(items)).toBe(true);
    });

    it("should return false when any item is PENDING", () => {
      const items = [makeItem(0, "SOLD"), makeItem(1, "PENDING")];
      expect(allItemsResolved(items)).toBe(false);
    });

    it("should return false when any item is ACTIVE", () => {
      const items = [makeItem(0, "ACTIVE"), makeItem(1, "SOLD")];
      expect(allItemsResolved(items)).toBe(false);
    });

    it("should return true for an empty array", () => {
      expect(allItemsResolved([])).toBe(true);
    });
  });

  describe("isFirstItemSlot", () => {
    it("should return the slot index of the first item", () => {
      const items = [makeItem(0), makeItem(1)];
      expect(isFirstItemSlot(items)).toBe(0);
    });

    it("should return 0 for an empty array", () => {
      expect(isFirstItemSlot([])).toBe(0);
    });
  });
});
