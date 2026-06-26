import type { Server, Socket } from "socket.io";

import { prisma } from "./prisma.js";
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

  const participantRow = await prisma.roomParticipant.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
    select: { id: true },
  });

  if (meta.status === "AUCTION" && meta.auctioneerId !== user.id) {
    if (!participantRow) {
      ack({
        ok: false,
        error: {
          message:
            "This auction is already in progress. You can only join rooms in the LOBBY phase.",
          reason: "ROOM_NOT_JOINABLE",
        },
      });
      return;
    }
  }

  const redisBidders = await getRedisBidders(roomId);
  if (redisBidders.length === 0) {
    const participants = await loadParticipants(roomId, meta.perRoomBudget);
    if (participants.length > 0) {
      await initRoomRedisState(meta, participants);
    }
  }

  const snapshot = await buildRoomSnapshot(roomId);
  if (!snapshot) {
    ack({ ok: false, error: { message: "room snapshot unavailable" } });
    return;
  }

  if (socket.data.roomId && socket.data.roomId !== roomId) {
    socket.leave(socket.data.roomId);
  }
  socket.data.roomId = roomId;
  socket.join(roomId);

  await markPresent(roomId, user.id);
  await broadcastPresence(io, roomId);

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

  ack({ ok: true, data: snapshot });
}