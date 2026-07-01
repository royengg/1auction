import type {
  AuctionItem,
  RoomDetail,
  RoomParticipant,
  RoomSummary,
} from "@auction/shared";
import type {
  AuctionItem as PrismaItem,
  Room as PrismaRoom,
  RoomParticipant as PrismaParticipant,
  User as PrismaUser,
} from "@prisma/client";

import { AUCTION_ROOM } from "@auction/shared";
import { formatCurrency } from "./utils";

type CountRoom = PrismaRoom & {
  auctioneer: PrismaUser;
  items: unknown[];
  participants: unknown[];
};

type DetailRoom = PrismaRoom & {
  auctioneer: PrismaUser;
  items: PrismaItem[];
  participants: (PrismaParticipant & { user: PrismaUser })[];
};

export function mapItem(item: PrismaItem): AuctionItem {
  return {
    id: item.id,
    roomId: item.roomId,
    slotIndex: item.slotIndex,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl ?? null,
    startingPrice: item.startingPrice,
    status: item.status,
    winnerId: item.winnerId ?? null,
    winningBid: item.winningBid ?? null,
  };
}

export function mapParticipant(
  p: PrismaParticipant & { user?: { name: string; activeRole?: PrismaUser["activeRole"] } },
  budget: number,
): RoomParticipant {
  const reserved = p.reserved;
  const spent = p.spent;
  const available = Math.max(0, budget - reserved - spent);
  return {
    userId: p.userId,
    name: p.user?.name ?? "",
    role: p.user?.activeRole ?? "BIDDER",
    budget,
    reserved,
    available,
    spent,
  };
}

export function buildRoomSummary(room: CountRoom): RoomSummary {
  return {
    id: room.id,
    code: room.code,
    title: room.title,
    description: room.description,
    status: room.status,
    auctioneerId: room.auctioneerId,
    auctioneerName: room.auctioneer.name,
    itemCount: room.items.length,
    bidderCount: room.participants.length,
    perRoomBudget: room.perRoomBudget,
    minIncrement: room.minIncrement,
    maxBidders: room.maxBidders,
    coverImageUrl: room.coverImageUrl ?? null,
    createdAt: room.createdAt.toISOString(),
  };
}

export function buildRoomDetail(room: DetailRoom): RoomDetail {
  const participants = room.participants.map((p) =>
    mapParticipant(p, room.perRoomBudget),
  );

  // Include auctioneer in participants list if not already present
  const auctioneerId = room.auctioneerId;
  const hasAuctioneer = participants.some((p) => p.userId === auctioneerId);
  if (!hasAuctioneer) {
    participants.unshift({
      userId: auctioneerId,
      name: room.auctioneer.name,
      role: "AUCTIONEER",
      budget: 0,
      reserved: 0,
      available: 0,
      spent: 0,
    });
  }

  return {
    ...buildRoomSummary({
      ...room,
      items: room.items,
      participants: room.participants,
    }),
    items: room.items.map(mapItem),
    participants,
    activeItemIndex: room.activeItemIndex,
  };
}

export function describeBudget(amount: number): string {
  return `${formatCurrency(amount)} per bidder (max ${
    AUCTION_ROOM.MAX_BIDDERS
  } bidders)`;
}