import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth-context";
import { jsonError, unauthorized } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { mapParticipant } from "@/lib/room-mappers";

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
      include: { user: { select: { name: true } }, item: true },
      orderBy: { item: { slotIndex: "asc" } },
    });

    const winnerMap = new Map(winners.map((w) => [w.itemId, w]));

    const resolvedItems = room.items
      .filter((i) => i.status === "SOLD" || i.status === "UNSOLD")
      .map((i) => {
        const winner = winnerMap.get(i.id);
        return {
          itemId: i.id,
          slotIndex: i.slotIndex,
          name: i.name,
          status: i.status,
          winnerId: winner?.userId ?? null,
          winnerName: winner?.user.name ?? null,
          winningBid: winner?.amount ?? null,
          resolvedAt: winner?.wonAt.toISOString() ?? i.resolvedAt?.toISOString() ?? room.completedAt?.toISOString() ?? new Date().toISOString(),
        };
      });

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
      items: resolvedItems,
      participants: room.participants.map((p) =>
        mapParticipant(p, room.perRoomBudget),
      ),
      winners: resolvedItems,
    });
  } catch (err) {
    return jsonError(err);
  }
}