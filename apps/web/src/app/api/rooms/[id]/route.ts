import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth-context";
import { forbidden, jsonError, unauthorized } from "@/lib/api-errors";
import { getRoomDetail } from "@/lib/room-repo";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  const { id } = await params;
  try {
    const room = await getRoomDetail(id);
    return NextResponse.json(room);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  const { id: roomId } = await params;

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { auctioneerId: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.auctioneerId !== ctx.userId) {
      return forbidden("Only the auctioneer can cancel this room.");
    }

    // Delete from database (cascade will handle related records)
    await prisma.room.delete({
      where: { id: roomId },
    });

    // Clean up Redis
    const redis = getRedis();
    await redis.del(`auction:room:${roomId}`);
    await redis.del(`auction:bidders:${roomId}`);
    await redis.del(`auction:resolved:${roomId}`);
    await redis.del(`auction:presence:${roomId}`);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}