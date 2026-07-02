"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { publicEnv } from "@/lib/env-client";
import { apiClient } from "@/lib/api-client";
import {
  ClientEvent,
  type AckResponse,
  type ClientAuthenticatePayload,
  type SessionUser,
} from "@auction/shared";

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  authenticated: boolean;
  user: SessionUser | null;
  error: string | null;
}

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const tokenRes = await apiClient.getSocketToken();

      if (cancelled) return;

      const s = io(publicEnv.socketUrl, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5_000,
        // Allow Socket.IO to auto-negotiate: HTTP polling first, then upgrade to WebSocket.
        // This is more reliable behind reverse proxies (e.g. Traefik/Coolify) than forcing websocket-only.
        transports: ["polling", "websocket"],
      });

      socketRef.current = s;
      setSocket(s);

      s.on("connect", () => {
        setConnected(true);
        setError(null);
        const payload: ClientAuthenticatePayload = { token: tokenRes.token };
        s.emit(ClientEvent.AUTHENTICATE, payload, (ack: AckResponse<SessionUser>) => {
          if (ack.ok) {
            setAuthenticated(true);
            setUser(ack.data);
          } else {
            setError(ack.error.message);
          }
        });
      });

      s.on("disconnect", () => {
        setConnected(false);
        setAuthenticated(false);
      });

      s.on("connect_error", (err: Error) => {
        setError(`WebSocket: ${err.message}`);
        console.error("[Socket] connect_error:", err.message, err);
      });
    }

    connect().catch((err) => {
      setError(err instanceof Error ? err.message : "Connection failed");
    });

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return { socket, connected, authenticated, user, error };
}