import { prisma } from "./prisma";
import { withDbRetry } from "./prisma-retry";
import { generateRoomCode } from "./room-code";
import { buildRoomDetail, buildRoomSummary, mapItem } from "./room-mappers";

import { AUCTION_ROOM, type RoomSummary } from "@auction/shared";
import {
  createRoomInputSchema,
  joinRoomInputSchema,
} from "@auction/shared/schemas";
import { z } from "zod";

export type CreateRoomInput = z.infer<typeof createRoomInputSchema>;

const MAX_CODE_ATTEMPTS = 10;

export async function createRoom(
  auctioneerId: string,
  input: CreateRoomInput,
) {
  const parsed = createRoomInputSchema.parse(input);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();

    try {
      const room = await withDbRetry(() =>
        prisma.$transaction(async (tx) => {
          const created = await tx.room.create({
          data: {
            code,
            title: parsed.title,
            description: parsed.description ?? "",
            status: "LOBBY",
            auctioneerId,
            perRoomBudget: parsed.perRoomBudget,
            minIncrement: parsed.minIncrement,
            itemDurationSeconds: parsed.itemDurationSeconds,
            maxBidders: parsed.maxBidders,
            coverImageUrl: parsed.coverImageUrl ?? null,
            items: {
              create: parsed.items.map((item, slotIndex) => ({
                slotIndex,
                name: item.name,
                description: item.description ?? "",
                imageUrl: item.imageUrl ?? null,
                startingPrice: item.startingPrice,
              })),
            },
          },
          include: {
            auctioneer: true,
            items: { orderBy: { slotIndex: "asc" } },
            participants: { include: { user: true } },
          },
        });

        await tx.roomParticipant.create({
          data: {
            roomId: created.id,
            userId: auctioneerId,
            budget: 0,
            reserved: 0,
            spent: 0,
          },
        });

          return created;
        }),
      );

      return buildRoomDetail(room);
    } catch (err) {
      if (
        err instanceof Error &&
        /code.*unique|Unique.*code/i.test(err.message) &&
        attempt < MAX_CODE_ATTEMPTS - 1
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Unable to generate a unique room code after 10 attempts.");
}

export async function listRooms(viewerId?: string): Promise<RoomSummary[]> {
  const rooms = await withDbRetry(() =>
    prisma.room.findMany({
      include: {
        auctioneer: true,
        items: { select: { id: true } },
        participants: { select: { id: true, userId: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
  );

  return rooms.map((room) => {
    const summary = buildRoomSummary(room);
    if (viewerId) {
      summary.isParticipant = room.participants.some(
        (p) => p.userId === viewerId,
      );
    }
    return summary;
  });
}

export async function getRoomDetail(roomId: string) {
  const room = await withDbRetry(() =>
    prisma.room.findUnique({
      where: { id: roomId },
      include: {
        auctioneer: true,
        items: { orderBy: { slotIndex: "asc" } },
        participants: {
          include: { user: true },
          orderBy: { joinedAt: "asc" },
        },
      },
    }),
  );

  if (!room) {
    throw new RoomNotFoundError(roomId);
  }

  return buildRoomDetail(room);
}

export async function findRoomByCode(code: string) {
  const parsed = joinRoomInputSchema.parse({ code });
  const room = await prisma.room.findUnique({
    where: { code: parsed.code },
    select: {
      id: true,
      title: true,
      status: true,
      auctioneerId: true,
      perRoomBudget: true,
      _count: { select: { participants: true } },
    },
  });

  if (!room) {
    throw new RoomNotFoundError(`code=${code}`);
  }

  return room;
}

export async function joinRoom(
  roomId: string,
  userId: string,
): Promise<{ joined: boolean; roomId: string }> {
  return await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        status: true,
        auctioneerId: true,
        perRoomBudget: true,
        _count: { select: { participants: true } },
      },
    });

    if (!room) throw new RoomNotFoundError(roomId);
    if (room.status !== "LOBBY") throw new RoomNotJoinableError(room.status);
    if (room.auctioneerId === userId) throw new UserIsAuctioneerError();

    const existing = await tx.roomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { id: true },
    });

    if (existing) {
      return { joined: false, roomId };
    }

    const participantCount = room._count.participants;
    const maxWithAuctioneer = AUCTION_ROOM.MAX_BIDDERS + 1;
    if (participantCount >= maxWithAuctioneer) {
      throw new RoomFullError(AUCTION_ROOM.MAX_BIDDERS);
    }

    await tx.roomParticipant.create({
      data: {
        roomId,
        userId,
        budget: room.perRoomBudget,
        reserved: 0,
        spent: 0,
      },
    });

    return { joined: true, roomId };
  });
}

export async function resolveItem(
  roomId: string,
  itemId: string,
  outcome: "SOLD" | "UNSOLD",
  winnerId: string | null,
  winningBid: number | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const item = await tx.auctionItem.findUnique({
      where: { id: itemId },
      select: { id: true, status: true, roomId: true },
    });

    if (!item || item.roomId !== roomId) return;
    if (item.status === "SOLD" || item.status === "UNSOLD") return;

    const resolvedAt = new Date();
    await tx.auctionItem.update({
      where: { id: itemId },
      data: {
        status: outcome,
        winnerId: outcome === "SOLD" ? winnerId : null,
        winningBid: outcome === "SOLD" ? winningBid : null,
        resolvedAt,
      },
    });

    if (outcome === "SOLD" && winnerId && winningBid != null) {
      await tx.winner.upsert({
        where: { roomId_itemId: { roomId, itemId } },
        update: {},
        create: { roomId, itemId, userId: winnerId, amount: winningBid },
      });
      await tx.bid.create({
        data: {
          roomId,
          itemId,
          userId: winnerId,
          amount: winningBid,
          placedAt: resolvedAt,
        },
      });
    }
  });
}

export async function chargeWinner(
  roomId: string,
  userId: string,
  amount: number,
): Promise<void> {
  await prisma.roomParticipant.update({
    where: { roomId_userId: { roomId, userId } },
    data: {
      reserved: { decrement: amount },
      spent: { increment: amount },
    },
  });
}

export async function completeRoom(roomId: string): Promise<void> {
  await prisma.room.updateMany({
    where: { id: roomId, status: "AUCTION" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}

export async function recordBid(
  roomId: string,
  itemId: string,
  userId: string,
  amount: number,
): Promise<void> {
  await prisma.bid.create({
    data: { roomId, itemId, userId, amount },
  });
}

export async function syncReservedBudget(
  roomId: string,
  newHighBidderId: string,
  newReservedAmount: number,
  previousHighBidderId: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (previousHighBidderId) {
      await tx.roomParticipant.update({
        where: { roomId_userId: { roomId, userId: previousHighBidderId } },
        data: { reserved: 0 },
      });
    }
    await tx.roomParticipant.update({
      where: { roomId_userId: { roomId, userId: newHighBidderId } },
      data: { reserved: newReservedAmount },
    });
  });
}

export async function startAuction(
  roomId: string,
  auctioneerId: string,
): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { status: true, auctioneerId: true },
  });

  if (!room) throw new RoomNotFoundError(roomId);
  if (room.auctioneerId !== auctioneerId) throw new NotAuctioneerError();
  if (room.status !== "LOBBY") throw new RoomNotJoinableError(room.status);

  await prisma.room.update({
    where: { id: roomId },
    data: { status: "AUCTION", activeItemIndex: 0 },
  });
}

export async function markItemActive(
  roomId: string,
  itemId: string,
): Promise<void> {
  await prisma.auctionItem.updateMany({
    where: { id: itemId, roomId, status: "PENDING" },
    data: { status: "ACTIVE" },
  });
}

export async function setActiveItemIndex(
  roomId: string,
  activeItemIndex: number | null,
): Promise<void> {
  await prisma.room.update({
    where: { id: roomId },
    data: { activeItemIndex },
  });
}

export async function getItem(roomId: string, itemId: string) {
  const item = await prisma.auctionItem.findFirst({
    where: { id: itemId, roomId },
  });
  if (!item) throw new ItemNotFoundError(itemId);
  return mapItem(item);
}

export async function listItems(roomId: string) {
  const items = await prisma.auctionItem.findMany({
    where: { roomId },
    orderBy: { slotIndex: "asc" },
  });
  return items.map(mapItem);
}

export class RoomNotFoundError extends Error {
  constructor(id: string) {
    super(`Room not found: ${id}`);
    this.name = "RoomNotFoundError";
  }
}

export class ItemNotFoundError extends Error {
  constructor(id: string) {
    super(`Item not found: ${id}`);
    this.name = "ItemNotFoundError";
  }
}

export class RoomNotJoinableError extends Error {
  constructor(currentStatus: string) {
    super(
      `Room is not joinable in its current status: ${currentStatus}. Only LOBBY rooms accept new bidders.`,
    );
    this.name = "RoomNotJoinableError";
  }
}

export class RoomFullError extends Error {
  constructor(capacity: number) {
    super(
      `Room is full. Maximum ${capacity} bidders (plus the auctioneer) are allowed.`,
    );
    this.name = "RoomFullError";
  }
}

export class UserIsAuctioneerError extends Error {
  constructor() {
    super("The auctioneer cannot join their own room as a bidder.");
    this.name = "UserIsAuctioneerError";
  }
}

export class NotAuctioneerError extends Error {
  constructor() {
    super("Only the auctioneer of this room can perform that action.");
    this.name = "NotAuctioneerError";
  }
}