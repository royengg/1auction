import { NextRequest, NextResponse } from "next/server";
import { createRoomInputSchema } from "@auction/shared/schemas";

import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, jsonError, unauthorized } from "@/lib/api-errors";
import { createRoom, listRooms } from "@/lib/room-repo";

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  if (ctx.activeRole !== "AUCTIONEER") {
    return forbidden(
      "Only the Auctioneer profile can create rooms. Switch profiles to continue.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid json body");
  }

  const parseResult = createRoomInputSchema.safeParse(body);
  if (!parseResult.success) {
    return badRequest(parseResult.error.message);
  }

  try {
    const room = await createRoom(ctx.userId, parseResult.data);
    return NextResponse.json(room, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  const rooms = await listRooms(ctx.userId);
  return NextResponse.json({ rooms, viewerRole: ctx.activeRole });
}