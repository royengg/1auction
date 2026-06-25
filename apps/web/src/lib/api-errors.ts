import { NextResponse } from "next/server";

import {
  NotAuctioneerError,
  RoomFullError,
  RoomNotFoundError,
  RoomNotJoinableError,
  UserIsAuctioneerError,
} from "./room-repo";

type ErrorMap = Record<string, { status: number; message?: string }>;

const ERROR_MAP: ErrorMap = {
  RoomNotFoundError: { status: 404 },
  RoomNotJoinableError: { status: 409 },
  RoomFullError: { status: 409 },
  UserIsAuctioneerError: { status: 409 },
  NotAuctioneerError: { status: 403 },
};

export function jsonError(err: unknown): NextResponse {
  if (err instanceof Error && err.name in ERROR_MAP) {
    const mapped = ERROR_MAP[err.name]!;
    return NextResponse.json(
      { error: mapped.message ?? err.message },
      { status: mapped.status },
    );
  }

  if (err instanceof Error && err.message.startsWith("Invalid")) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.error("[api] unhandled:", err);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(message = "unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}