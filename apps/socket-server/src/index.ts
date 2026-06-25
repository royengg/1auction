import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";

import { env } from "./env.js";
import { getRedis, closeRedis } from "./redis.js";
import { verifySocketToken, type SessionUser } from "./auth.js";
import { handleJoinRoom } from "./join.js";
import { placeBid } from "./bids.js";
import {
  handlePause,
  handleResume,
  handleStartAuction,
} from "./auctioneer.js";
import { registerChat } from "./chat.js";
import { markAbsent, broadcastPresence } from "./presence.js";
import { ClientEvent, type Ack } from "@auction/shared";

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

  socket.on(
    ClientEvent.AUTHENTICATE,
    (payload: unknown, ack: Ack<SessionUser>) => {
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
    },
  );

  socket.on(ClientEvent.JOIN_ROOM, (payload: unknown, ack: Ack) =>
    handleJoinRoom(io, socket, payload, ack as Parameters<typeof handleJoinRoom>[3]),
  );

  socket.on(ClientEvent.PLACE_BID, (payload: unknown, ack: Ack) =>
    placeBid(io, socket, payload, ack as Parameters<typeof placeBid>[3]),
  );

  socket.on(ClientEvent.START_AUCTION, (payload: unknown, ack: Ack) =>
    handleStartAuction(io, socket, payload, ack as Parameters<typeof handleStartAuction>[3]),
  );

  socket.on(ClientEvent.PAUSE_AUCTION, (payload: unknown, ack: Ack) =>
    handlePause(io, socket, payload, ack as Parameters<typeof handlePause>[3]),
  );

  socket.on(ClientEvent.RESUME_AUCTION, (payload: unknown, ack: Ack) =>
    handleResume(io, socket, payload, ack as Parameters<typeof handleResume>[3]),
  );

  registerChat(socket, io);

  socket.on("disconnect", async () => {
    const user = socket.data.user as SessionUser | undefined;
    const roomId = socket.data.roomId as string | undefined;
    if (user && roomId) {
      await markAbsent(roomId, user.id);
      await broadcastPresence(io, roomId);
    }
  });

  socket.on(ClientEvent.LEAVE_ROOM, () => {
    const user = socket.data.user as SessionUser | undefined;
    const roomId = socket.data.roomId as string | undefined;
    if (roomId) {
      socket.leave(roomId);
      socket.data.roomId = undefined;
      if (user) {
        void markAbsent(roomId, user.id);
        void broadcastPresence(io, roomId);
      }
    }
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