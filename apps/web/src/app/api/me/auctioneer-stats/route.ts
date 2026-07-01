import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get all rooms where user is auctioneer
  const rooms = await prisma.room.findMany({
    where: { auctioneerId: userId },
    include: {
      items: true,
      _count: { select: { bids: true } },
    },
  });

  const totalBidsToday = await prisma.bid.count({
    where: {
      room: { auctioneerId: userId },
      placedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  // Current value = sum of winning bids across all completed rooms
  const currentValue = rooms.reduce((sum, room) => {
    return sum + room.items.reduce((itemSum, item) => {
      return itemSum + (item.winningBid ?? 0);
    }, 0);
  }, 0);

  // Success rate = sold items / total items
  const totalItems = rooms.reduce((sum, room) => sum + room.items.length, 0);
  const soldItems = rooms.reduce(
    (sum, room) => sum + room.items.filter((i) => i.status === "SOLD").length,
    0,
  );
  const successRate = totalItems > 0 ? Math.round((soldItems / totalItems) * 100) : 0;

  return NextResponse.json({
    totalBidsToday,
    currentValue,
    successRate: `${successRate}%`,
  });
}
