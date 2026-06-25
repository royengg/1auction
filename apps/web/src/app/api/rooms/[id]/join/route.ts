import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, jsonError, unauthorized } from "@/lib/api-errors";
import {
  findRoomByCode,
  getRoomDetail,
  joinRoom,
} from "@/lib/room-repo";
import { seedBidderInRedis } from "@/lib/room-redis";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  if (ctx.activeRole !== "BIDDER") {
    return forbidden(
      "Only the Bidder profile can join auctions. Switch profiles to continue.",
    );
  }

  const { id: roomId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid json body");
  }

  const code =
    typeof body === "object" && body && "code" in body
      ? String((body as { code: unknown }).code)
      : null;

  if (!code) return badRequest("room code is required");

  try {
    const byCode = await findRoomByCode(code);
    if (byCode.id !== roomId) {
      return NextResponse.json(
        { error: "room code does not match this room" },
        { status: 400 },
      );
    }

    const { joined } = await joinRoom(roomId, ctx.userId);

    const room = await getRoomDetail(roomId);
    const me = room.participants.find((p) => p.userId === ctx.userId);
    if (me) {
      await seedBidderInRedis(roomId, me);
    }

    return NextResponse.json({ joined, room });
  } catch (err) {
    return jsonError(err);
  }
}