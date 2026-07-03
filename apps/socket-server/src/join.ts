import type { Server, Socket } from "socket.io";

import { getRedis } from "./redis.js";
import { spectatorsKey } from "./keys.js";
import { prisma } from "./prisma.js";
import { withDbRetry } from "./prisma-retry.js";
import {
  buildRoomSnapshot,
  getRedisBidders,
  initRoomRedisState,
  loadParticipants,
  loadRoomMeta,
} from "./room-state.js";
import { markPresent, broadcastPresence } from "./presence.js";
import { type Ack, type LiveRoomState, ServerEvent } from "@auction/shared";

export async function handleJoinRoom(
  io: Server,
  socket: Socket,
  payload: unknown,
  ack: Ack<LiveRoomState>,
): Promise<void> {
  const user = socket.data.user;
  if (!user) {
    ack({ ok: false, error: { message: "not authenticated" } });
    return;
  }

  const roomId =
    typeof payload === "object" &&
    payload &&
    "roomId" in payload &&
    typeof (payload as { roomId?: unknown }).roomId === "string"
      ? (payload as { roomId: string }).roomId
      : null;

  if (!roomId) {
    ack({ ok: false, error: { message: "roomId is required" } });
    return;
  }

  const meta = await loadRoomMeta(roomId);
  if (!meta) {
    ack({ ok: false, error: { message: "room not found" } });
    return;
  }

  const participantRow = await withDbRetry(() =>
    prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
      select: { id: true },
    }),
  );

  const isAuctioneer = meta.auctioneerId === user.id;
  let isSpectator = false;

  if (meta.status === "AUCTION" && !isAuctioneer) {
    if (!participantRow) {
      // Join as spectator
      isSpectator = true;
    }
  } else if (meta.status === "LOBBY" && !isAuctioneer && !participantRow) {
    ack({
      ok: false,
      error: {
        message:
          "You are not a participant in this room. Join the lobby first.",
        reason: "ROOM_NOT_JOINABLE",
      },
    });
    return;
  }

  const redis = getRedis();

  // Always ensure bidders are synced to Redis before building snapshot,
  // regardless of whether the joining user is a spectator or not.
  const redisBidders = await getRedisBidders(roomId);
  if (redisBidders.length === 0) {
    const participants = await loadParticipants(roomId, meta.perRoomBudget);
    if (participants.length > 0) {
      await initRoomRedisState(meta, participants);
    }
  }

  if (isSpectator) {
    // Track spectator in Redis
    await redis.sadd(spectatorsKey(roomId), user.id);
  }

  const snapshot = await buildRoomSnapshot(roomId);
  if (!snapshot) {
    ack({ ok: false, error: { message: "room snapshot unavailable" } });
    return;
  }

  if (socket.data.roomId && socket.data.roomId !== roomId) {
    socket.leave(socket.data.roomId);
    // Remove from old room's spectators if applicable
    if (socket.data.isSpectator) {
      await redis.srem(spectatorsKey(socket.data.roomId), user.id);
    }
  }
  socket.data.roomId = roomId;
  socket.data.isSpectator = isSpectator;
  socket.join(roomId);

  if (isSpectator) {
    // Broadcast updated spectator count to room after joining
    const spectatorIds = await redis.smembers(spectatorsKey(roomId));
    io.to(roomId).emit(ServerEvent.SPECTATORS_CHANGED, { spectatorIds });
  }

  await markPresent(roomId, user.id);
  await broadcastPresence(io, roomId);

  if (!isSpectator) {
    io.to(roomId).emit(ServerEvent.PARTICIPANT_UPDATE, {
      participant:
        snapshot.bidders.find((b) => b.userId === user.id) ?? {
          userId: user.id,
          name: user.name,
          role: user.role,
          budget: 0,
          reserved: 0,
          available: 0,
          spent: 0,
        },
    });
  }

  ack({ ok: true, data: snapshot });
}