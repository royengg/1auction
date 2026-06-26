"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  ClientEvent,
  ServerEvent,
  type AckResponse,
  type ChatMessage,
  type LiveBid,
  type LiveItemState,
  type LiveRoomState,
  type ResolvedItem,
  type RoomParticipant,
  type RoomStatus,
} from "@auction/shared";

interface UseRoomStateReturn {
  roomState: LiveRoomState | null;
  chatMessages: ChatMessage[];
  bidHistory: LiveBid[];
  presence: string[];
  error: string | null;
  placeBid: (amount: number) => Promise<AckResponse>;
  sendChat: (text: string) => Promise<AckResponse>;
  startAuction: () => Promise<AckResponse>;
  pauseAuction: () => Promise<AckResponse>;
  resumeAuction: () => Promise<AckResponse>;
}

export function useRoomState(
  socket: Socket | null,
  roomId: string,
): UseRoomStateReturn {
  const [roomState, setRoomState] = useState<LiveRoomState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [bidHistory, setBidHistory] = useState<LiveBid[]>([]);
  const [presence, setPresence] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!socket || !roomId) return;

    function handleJoinAck(ack: AckResponse<LiveRoomState>) {
      if (ack.ok) {
        setRoomState(ack.data);
        joinedRef.current = true;
      } else {
        setError(ack.error.message);
      }
    }

    socket.emit(ClientEvent.JOIN_ROOM, { roomId }, handleJoinAck);

    function onRoomState(state: LiveRoomState) {
      setRoomState(state);
    }

    function onParticipantUpdate({
      participant,
    }: {
      participant: RoomParticipant;
    }) {
      setRoomState((prev) => {
        if (!prev) return prev;
        const existing = prev.bidders.findIndex(
          (b) => b.userId === participant.userId,
        );
        const bidders =
          existing >= 0
            ? prev.bidders.map((b, i) => (i === existing ? participant : b))
            : [...prev.bidders, participant];
        return { ...prev, bidders };
      });
    }

    function onParticipantLeft({ userId }: { userId: string }) {
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bidders: prev.bidders.filter((b) => b.userId !== userId),
        };
      });
    }

    function onRoomStatusChanged({ status }: { status: RoomStatus }) {
      setRoomState((prev) => (prev ? { ...prev, status } : prev));
    }

    function onItemResolved({ item }: { item: ResolvedItem }) {
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          resolvedItems: [...prev.resolvedItems, item],
        };
      });
    }

    function onActiveItemChanged({ item }: { item: LiveItemState | null }) {
      setBidHistory([]);
      setRoomState((prev) => (prev ? { ...prev, activeItem: item } : prev));
    }

    function onItemStateUpdate({
      itemId,
      patch,
    }: {
      itemId: string;
      patch: Partial<LiveItemState>;
    }) {
      setRoomState((prev) => {
        if (!prev || !prev.activeItem || prev.activeItem.itemId !== itemId)
          return prev;
        return {
          ...prev,
          activeItem: { ...prev.activeItem, ...patch },
        };
      });
    }

    function onBidAccepted({
      bid,
      bidders,
    }: {
      roomId: string;
      itemId: string;
      bid: LiveBid;
      bidders: RoomParticipant[];
    }) {
      setBidHistory((prev) => [...prev, bid]);
      setRoomState((prev) => {
        if (!prev || !prev.activeItem) return prev;
        return {
          ...prev,
          activeItem: { ...prev.activeItem, highBid: bid },
          bidders,
        };
      });
    }

    function onPauseState({
      paused,
      endsAt,
    }: {
      paused: boolean;
      endsAt: number | null;
    }) {
      setRoomState((prev) => {
        if (!prev || !prev.activeItem) return prev;
        return {
          ...prev,
          activeItem: {
            ...prev.activeItem,
            paused,
            endsAt: endsAt ?? prev.activeItem.endsAt,
          },
        };
      });
    }

    function onChatMessage(message: ChatMessage) {
      setChatMessages((prev) => [...prev, message]);
    }

    function onPresence({ users }: { users: string[] }) {
      setPresence(users);
    }

    function onError({ message }: { message: string }) {
      setError(message);
    }

    socket.on(ServerEvent.ROOM_STATE, onRoomState);
    socket.on(ServerEvent.PARTICIPANT_UPDATE, onParticipantUpdate);
    socket.on(ServerEvent.PARTICIPANT_LEFT, onParticipantLeft);
    socket.on(ServerEvent.ROOM_STATUS_CHANGED, onRoomStatusChanged);
    socket.on(ServerEvent.ITEM_RESOLVED, onItemResolved);
    socket.on(ServerEvent.ACTIVE_ITEM_CHANGED, onActiveItemChanged);
    socket.on(ServerEvent.ITEM_STATE_UPDATE, onItemStateUpdate);
    socket.on(ServerEvent.BID_ACCEPTED, onBidAccepted);
    socket.on(ServerEvent.PAUSE_STATE, onPauseState);
    socket.on(ServerEvent.CHAT_MESSAGE, onChatMessage);
    socket.on(ServerEvent.PRESENCE, onPresence);
    socket.on(ServerEvent.ERROR, onError);

    return () => {
      socket.off(ServerEvent.ROOM_STATE, onRoomState);
      socket.off(ServerEvent.PARTICIPANT_UPDATE, onParticipantUpdate);
      socket.off(ServerEvent.PARTICIPANT_LEFT, onParticipantLeft);
      socket.off(ServerEvent.ROOM_STATUS_CHANGED, onRoomStatusChanged);
socket.off(ServerEvent.ITEM_RESOLVED, onItemResolved);
    socket.off(ServerEvent.ACTIVE_ITEM_CHANGED, onActiveItemChanged);
    socket.off(ServerEvent.ITEM_STATE_UPDATE, onItemStateUpdate);
    socket.off(ServerEvent.BID_ACCEPTED, onBidAccepted);
    socket.off(ServerEvent.PAUSE_STATE, onPauseState);
    socket.off(ServerEvent.CHAT_MESSAGE, onChatMessage);
      socket.off(ServerEvent.PRESENCE, onPresence);
      socket.off(ServerEvent.ERROR, onError);
      if (joinedRef.current) {
        socket.emit(ClientEvent.LEAVE_ROOM);
        joinedRef.current = false;
      }
    };
  }, [socket, roomId]);

  const placeBid = useCallback(
    (amount: number) =>
      new Promise<AckResponse>((resolve) => {
        if (!socket) return resolve({ ok: false, error: { message: "Not connected" } });
        socket.emit(ClientEvent.PLACE_BID, { roomId, amount }, resolve);
      }),
    [socket, roomId],
  );

  const sendChat = useCallback(
    (text: string) =>
      new Promise<AckResponse>((resolve) => {
        if (!socket) return resolve({ ok: false, error: { message: "Not connected" } });
        socket.emit(ClientEvent.SEND_CHAT, { roomId, text }, resolve);
      }),
    [socket, roomId],
  );

  const startAuction = useCallback(
    () =>
      new Promise<AckResponse>((resolve) => {
        if (!socket) return resolve({ ok: false, error: { message: "Not connected" } });
        socket.emit(ClientEvent.START_AUCTION, { roomId }, resolve);
      }),
    [socket, roomId],
  );

  const pauseAuction = useCallback(
    () =>
      new Promise<AckResponse>((resolve) => {
        if (!socket) return resolve({ ok: false, error: { message: "Not connected" } });
        socket.emit(ClientEvent.PAUSE_AUCTION, { roomId }, resolve);
      }),
    [socket, roomId],
  );

  const resumeAuction = useCallback(
    () =>
      new Promise<AckResponse>((resolve) => {
        if (!socket) return resolve({ ok: false, error: { message: "Not connected" } });
        socket.emit(ClientEvent.RESUME_AUCTION, { roomId }, resolve);
      }),
    [socket, roomId],
  );

  return {
    roomState,
    chatMessages,
    bidHistory,
    presence,
    error,
    placeBid,
    sendChat,
    startAuction,
    pauseAuction,
    resumeAuction,
  };
}