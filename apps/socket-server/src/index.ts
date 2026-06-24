import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";

import { env } from "./env.js";
import { getRedis, closeRedis } from "./redis.js";
import { verifySocketToken, type SessionUser } from "./auth.js";
import { ClientEvent, ServerEvent, type Ack } from "@auction/shared";

const app = express();
app.use(cors({ origin: env.webOrigin, credentials: true }));
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "socket-server" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.webOrigin, credentials: true },
});

io.on("connection", (socket) => {
  socket.data.user = undefined;
  socket.data.roomId = undefined;

  socket.on(ClientEvent.AUTHENTICATE, (payload: unknown, ack: Ack<SessionUser>): void => {
    try {
      const token =
        typeof payload === "object" && payload && "token" in payload
          ? String((payload as { token: unknown }).token)
          : null;
      if (!token) {
        ack({ ok: false, error: { message: "missing token" } });
        socket.disconnect();
        return;
      }
      const user = verifySocketToken(token);
      socket.data.user = user;
      socket.data.authenticatedAt = Date.now();
      ack({ ok: true, data: user });
    } catch (err) {
      ack({
        ok: false,
        error: {
          message: err instanceof Error ? err.message : "invalid token",
        },
      });
      socket.disconnect();
    }
  });

  const requireAuth = (): SessionUser | null => {
    if (!socket.data.user) {
      socket.emit(ServerEvent.ERROR, { message: "not authenticated" });
      return null;
    }
    return socket.data.user;
  };

  socket.on(ClientEvent.JOIN_ROOM, (_payload: unknown, ack: Ack) => {
    if (!requireAuth()) return ack({ ok: false, error: { message: "auth" } });
    ack({ ok: true, data: { todo: "joinRoom" } });
  });

  socket.on(ClientEvent.PLACE_BID, (_payload: unknown, ack: Ack) => {
    if (!requireAuth()) return ack({ ok: false, error: { message: "auth" } });
    ack({ ok: true, data: { todo: "placeBid" } });
  });

  socket.on(ClientEvent.START_AUCTION, (_payload: unknown, ack: Ack) => {
    if (!requireAuth()) return ack({ ok: false, error: { message: "auth" } });
    ack({ ok: true, data: { todo: "startAuction" } });
  });

  socket.on(ClientEvent.PAUSE_AUCTION, (_payload: unknown, ack: Ack) => {
    if (!requireAuth()) return ack({ ok: false, error: { message: "auth" } });
    ack({ ok: true, data: { todo: "pause" } });
  });

  socket.on(ClientEvent.RESUME_AUCTION, (_payload: unknown, ack: Ack) => {
    if (!requireAuth()) return ack({ ok: false, error: { message: "auth" } });
    ack({ ok: true, data: { todo: "resume" } });
  });

  socket.on(ClientEvent.SEND_CHAT, (_payload: unknown, ack: Ack) => {
    if (!requireAuth()) return ack({ ok: false, error: { message: "auth" } });
    ack({ ok: true, data: { todo: "chat" } });
  });

  socket.on("disconnect", () => {
    // Phase 4: presence cleanup, release reserved budget if appropriate.
  });
});

async function start(): Promise<void> {
  const redis = getRedis();
  await redis.ping();
  server.listen(env.port, () => {
    console.log(`[socket-server] listening on :${env.port}`);
  });
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[socket-server] received ${signal}, shutting down...`);
  io.close();
  server.close();
  await closeRedis();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

start().catch((err) => {
  console.error("[socket-server] fatal:", err);
  process.exit(1);
});