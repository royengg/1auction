"use client";

import { io, type Socket } from "socket.io-client";
import { publicEnv } from "@/lib/env-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(publicEnv.socketUrl, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
    // Allow Socket.IO to auto-negotiate: HTTP polling first, then upgrade to WebSocket.
    // This is more reliable behind reverse proxies (e.g. Traefik/Coolify) than forcing websocket-only.
    transports: ["polling", "websocket"],
  });
  return socket;
}

export function disposeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}