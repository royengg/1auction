export const ServerEvent = {
  ROOM_STATE: "room:state",
  PARTICIPANT_UPDATE: "room:participant:update",
  PARTICIPANT_LEFT: "room:participant:left",
  ROOM_STATUS_CHANGED: "room:status:changed",
  ACTIVE_ITEM_CHANGED: "room:activeItem:changed",
  ITEM_STATE_UPDATE: "room:item:state",
  ITEM_RESOLVED: "room:item:resolved",
  BID_ACCEPTED: "bid:accepted",
  BID_REJECTED: "bid:rejected",
  PAUSE_STATE: "auction:pause",
  CHAT_MESSAGE: "chat:message",
  PRESENCE: "presence",
  ERROR: "error",
} as const;

export const ClientEvent = {
  AUTHENTICATE: "client:authenticate",
  JOIN_ROOM: "client:joinRoom",
  LEAVE_ROOM: "client:leaveRoom",
  PLACE_BID: "client:placeBid",
  START_AUCTION: "client:startAuction",
  PAUSE_AUCTION: "client:pauseAuction",
  RESUME_AUCTION: "client:resumeAuction",
  END_AUCTION: "client:endAuction",
  SEND_CHAT: "client:sendChat",
  PRESENCE_PING: "client:presencePing",
} as const;

export type ServerEventName = (typeof ServerEvent)[keyof typeof ServerEvent];
export type ClientEventName = (typeof ClientEvent)[keyof typeof ClientEvent];

export interface ClientAuthenticatePayload {
  token: string;
}

export interface ClientJoinRoomPayload {
  roomId: string;
}

export interface ClientPlaceBidPayload {
  roomId: string;
  amount: number;
}

export interface ClientSendChatPayload {
  roomId: string;
  text: string;
}

export interface ClientPresencePingPayload {
  roomId: string;
}

import type {
  ChatMessage,
  LiveItemState,
  LiveRoomState,
  ResolvedItem,
  RoomParticipant,
  RoomStatus,
} from "./types.js";

export interface ServerRoomStatePayload extends LiveRoomState {}

export interface ServerParticipantUpdatePayload {
  participant: RoomParticipant;
}

export interface ServerParticipantLeftPayload {
  userId: string;
}

export interface ServerRoomStatusChangedPayload {
  status: RoomStatus;
}

export interface ServerActiveItemChangedPayload {
  item: LiveItemState | null;
}

export interface ServerItemStateUpdatePayload {
  itemId: string;
  patch: Partial<LiveItemState>;
}

export interface ServerItemResolvedPayload {
  item: ResolvedItem;
}

export interface ServerBidAcceptedPayload {
  roomId: string;
  itemId: string;
  bid: LiveItemState["highBid"];
  bidders: RoomParticipant[];
}

export type BidRejectReason =
  | "NOT_AUTHENTICATED"
  | "ROOM_NOT_AUCTION"
  | "ROOM_PAUSED"
  | "AUCTIONEER_CANNOT_BID"
  | "BID_TOO_LOW"
  | "INSUFFICIENT_BUDGET"
  | "ITEM_NOT_ACTIVE"
  | "TIMER_EXPIRED"
  | "INTERNAL_ERROR";

export interface ServerBidRejectedPayload {
  roomId: string;
  itemId: string;
  amount: number;
  reason: BidRejectReason;
  message: string;
}

export interface ServerPauseStatePayload {
  paused: boolean;
  endsAt: number | null;
}

export interface ServerChatMessagePayload extends ChatMessage {}

export interface ServerErrorPayload {
  message: string;
  code?: string;
}

export interface AckOk<T = unknown> {
  ok: true;
  data: T;
}

export interface AckErr {
  ok: false;
  error: {
    message: string;
    reason?: string;
  };
}

export type AckResponse<T = unknown> = AckOk<T> | AckErr;

export type Ack<T = unknown> = (response: AckResponse<T>) => void;