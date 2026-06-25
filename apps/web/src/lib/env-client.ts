/**
 * Client-safe env access. No side effects, no dotenv, no server secrets.
 * Safe to import from "use client" modules.
 *
 * Only NEXT_PUBLIC_* vars are inlined by Next.js at build time.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required public environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

export const publicEnv = {
  socketUrl: required(
    "NEXT_PUBLIC_SOCKET_URL",
    process.env.NEXT_PUBLIC_SOCKET_URL,
  ),
} as const;