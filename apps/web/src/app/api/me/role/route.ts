import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

const validRoles: Role[] = ["AUCTIONEER", "BIDDER"];

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const role = typeof body === "object" && body && "role" in body
    ? (body as { role: string }).role
    : null;

  if (!role || !validRoles.includes(role as Role)) {
    return NextResponse.json(
      { error: "invalid role. Must be AUCTIONEER or BIDDER." },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { activeRole: role as Role },
    select: { id: true, activeRole: true },
  });

  return NextResponse.json(updated);
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: session.user.id,
    activeRole: session.user.activeRole,
  });
}