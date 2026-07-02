import type { Server, Socket } from "socket.io";
import { randomUUID } from "node:crypto";

import {
  ClientEvent,
  ServerEvent,
  type ChatMessage,
  type Ack,
} from "@auction/shared";
import { LIMITS } from "@auction/shared";

export function registerChat(socket: Socket, io: Server): void {
  socket.on(
    ClientEvent.SEND_CHAT,
    (payload: unknown, ack: Ack<ChatMessage>) => {
      const user = socket.data.user;
      const roomId = socket.data.roomId;
      if (!user || !roomId) {
        ack({ ok: false, error: { message: "not in a room" } });
        return;
      }

      const text =
        typeof payload === "object" &&
        payload &&
        "text" in payload &&
        typeof (payload as { text?: unknown }).text === "string"
          ? (payload as { text: string }).text
          : "";

      if (!text || text.length === 0) {
        ack({ ok: false, error: { message: "message text is required" } });
        return;
      }
      if (text.length > LIMITS.CHAT_MESSAGE_MAX) {
        ack({
          ok: false,
          error: {
            message: `messages must be at most ${LIMITS.CHAT_MESSAGE_MAX} characters`,
          },
        });
        return;
      }

      const message: ChatMessage = {
        id: randomUUID(),
        roomId,
        userId: user.id,
        userName: user.name,
        text,
        sentAt: new Date().toISOString(),
        isSpectator: socket.data.isSpectator ?? false,
      };

      io.to(roomId).emit(ServerEvent.CHAT_MESSAGE, message);
      ack({ ok: true, data: message });
    },
  );
}