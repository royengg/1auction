import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth-context";
import { jsonError, unauthorized } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { mapItem, mapParticipant } from "@/lib/room-mappers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  const { id: roomId } = await params;

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        auctioneer: { select: { name: true } },
        items: { orderBy: { slotIndex: "asc" } },
        participants: {
          include: { user: { select: { name: true, activeRole: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!room) return jsonError(new Error("Room not found"));

    const winners = await prisma.winner.findMany({
      where: { roomId },
      include: { user: { select: { name: true } }, item: { select: { name: true } } },
      orderBy: { item: { slotIndex: "asc" } },
    });

    const soldItems = room.items
      .filter((i) => i.status === "SOLD" || i.status === "UNSOLD")
      .map((i) => ({
        ...mapItem(i),
        winnerName: winners.find((w) => w.itemId === i.id)?.user.name ?? null,
      }));

    return NextResponse.json({
      room: {
        id: room.id,
        title: room.title,
        code: room.code,
        status: room.status,
        auctioneerName: room.auctioneer.name,
        perRoomBudget: room.perRoomBudget,
        minIncrement: room.minIncrement,
        completedAt: room.completedAt?.toISOString() ?? null,
      },
      items: soldItems,
      participants: room.participants.map((p) =>
        mapParticipant(p, room.perRoomBudget),
      ),
      winners: winners.map((w) => ({
        itemId: w.itemId,
        itemName: w.item.name,
        userId: w.userId,
        userName: w.user.name,
        amount: w.amount,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}