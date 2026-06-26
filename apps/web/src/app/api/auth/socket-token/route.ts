import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }

  const token = jwt.sign(
    {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: (session.user.activeRole as string | undefined) ?? "BIDDER",
    },
    serverEnv.jwtSecret,
    { expiresIn: "7d" },
  );

  return NextResponse.json({ token });
}