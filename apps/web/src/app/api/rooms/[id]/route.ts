import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth-context";
import { jsonError, unauthorized } from "@/lib/api-errors";
import { getRoomDetail } from "@/lib/room-repo";

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