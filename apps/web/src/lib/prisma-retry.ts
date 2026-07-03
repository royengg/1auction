import { PrismaClient } from "@prisma/client";

type RetryableError =
  | { name: string; message: string; code?: string }
  | Error;

const TRANSIENT_ERROR_PATTERNS = [
  "Connection terminated",
  "Connection refused",
  "Connection lost",
  "Can't reach database server",
  "Server has closed the connection",
  "P1001",
  "P1002",
  "P1017",
  "P2028",
  "Timed out",
  "ETIMEDOUT",
  "ECONNRESET",
];

function isTransientError(err: unknown): boolean {
  const e = err as RetryableError;
  const name = e?.name ?? "";
  const message = e?.message ?? "";
  const code = (e as { code?: string })?.code ?? "";
  const haystack = `${name} ${message} ${code}`;
  return TRANSIENT_ERROR_PATTERNS.some((p) => haystack.includes(p));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (isTransientError(err) && attempt < retries) {
        const delay = BASE_DELAY_MS * (attempt + 1);
        console.warn(
          `[prisma-retry] transient DB error on attempt ${attempt + 1}/${retries + 1}, retrying in ${delay}ms:`,
          err instanceof Error ? err.message : err,
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;

let keepaliveTimer: NodeJS.Timeout | null = null;

export function startKeepalive(client: PrismaClient): void {
  if (keepaliveTimer) return;
  keepaliveTimer = setInterval(() => {
    client
      .$queryRaw`SELECT 1`
      .then(() => {})
      .catch((err) => {
        console.error("[prisma-keepalive] ping failed:", err);
      });
  }, KEEPALIVE_INTERVAL_MS);
  keepaliveTimer.unref?.();
}

export function stopKeepalive(): void {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
}
