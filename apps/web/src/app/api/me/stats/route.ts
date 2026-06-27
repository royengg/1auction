import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [activeBidsAgg, wonItemsAgg, totalExposureAgg] = await Promise.all([
    // Active bids = rooms where user has reserved > 0 (they're currently high bidder)
    prisma.roomParticipant.aggregate({
      where: { userId, reserved: { gt: 0 } },
      _count: { id: true },
    }),

    // Won items from Winner table (primary) + AuctionItem fallback
    prisma.winner.count({ where: { userId } }),

    // Total exposure from Winner table
    prisma.winner.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
  ]);

  // Fallback: also count AuctionItem.winnerId in case Winner table is incomplete
  const wonItemsFallback = await prisma.auctionItem.count({
    where: { winnerId: userId },
  });

  const wonItems = Math.max(wonItemsAgg, wonItemsFallback);

  // If Winner sum is 0 but AuctionItem has winningBid, compute fallback
  let totalExposure = totalExposureAgg._sum.amount ?? 0;
  if (totalExposure === 0 && wonItemsFallback > 0) {
    const fallbackAgg = await prisma.auctionItem.aggregate({
      where: { winnerId: userId },
      _sum: { winningBid: true },
    });
    totalExposure = fallbackAgg._sum.winningBid ?? 0;
  }

  return NextResponse.json({
    activeBids: activeBidsAgg._count.id,
    wonItems,
    totalExposure,
  });
}
