import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "./env.js";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "AUCTIONEER" | "BIDDER";
}

export interface AuthenticatedSocket {
  data: {
    user?: SessionUser;
    roomId?: string;
    authenticatedAt?: number;
  };
}

export function verifySocketToken(token: string): SessionUser {
  const payload = jwt.verify(token, env.jwtSecret) as JwtPayload & SessionUser;
  if (
    typeof payload.id !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.name !== "string" ||
    (payload.role !== "AUCTIONEER" && payload.role !== "BIDDER")
  ) {
    throw new Error("invalid token payload");
  }
  return {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };
}