import type { NextRequest } from "next/server";

import { auth } from "./auth";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  activeRole: Role;
}

export async function getAuthContext(
  request: NextRequest,
): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, activeRole: true },
  });

  if (!user) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    activeRole: user.activeRole,
  };
}