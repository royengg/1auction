import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth-context";
import { forbidden, jsonError, unauthorized } from "@/lib/api-errors";
import { startAuction } from "@/lib/room-repo";
import { publishControl } from "@/lib/redis";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  if (ctx.activeRole !== "AUCTIONEER") {
    return forbidden("Only the Auctioneer profile can start auctions.");
  }

  const { id: roomId } = await params;

  try {
    await startAuction(roomId, ctx.userId);
    await publishControl({
      type: "START_AUCTION",
      roomId,
      auctioneerId: ctx.userId,
    });
    return NextResponse.json({ ok: true, roomId, status: "AUCTION" });
  } catch (err) {
    return jsonError(err);
  }
}
