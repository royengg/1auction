export type Role = "AUCTIONEER" | "BIDDER";

export type RoomStatus = "LOBBY" | "AUCTION" | "COMPLETED";

export type ItemStatus = "PENDING" | "ACTIVE" | "SOLD" | "UNSOLD";

export type ItemOutcome = ItemStatus;

export interface User {
  id: string;
  email: string;
  name: string;
  activeRole: Role;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface RoomParticipant {
  userId: string;
  name: string;
  role: Role;
  budget: number;
  reserved: number;
  available: number;
  spent: number;
}

export interface AuctionItem {
  id: string;
  roomId: string;
  slotIndex: number;
  name: string;
  description: string;
  imageUrl: string | null;
  startingPrice: number;
  status: ItemStatus;
  winnerId: string | null;
  winningBid: number | null;
}

export interface RoomSummary {
  id: string;
  code: string;
  title: string;
  description: string;
  status: RoomStatus;
  auctioneerId: string;
  auctioneerName: string;
  itemCount: number;
  bidderCount: number;
  perRoomBudget: number;
  minIncrement: number;
  createdAt: string;
}

export interface RoomDetail extends RoomSummary {
  items: AuctionItem[];
  participants: RoomParticipant[];
  activeItemIndex: number | null;
}

export interface LiveBid {
  userId: string;
  userName: string;
  amount: number;
  placedAt: string;
}

export interface LiveItemState {
  itemId: string;
  slotIndex: number;
  name: string;
  imageUrl: string | null;
  startingPrice: number;
  status: ItemStatus;
  highBid: LiveBid | null;
  endsAt: number | null;
  paused: boolean;
  pausedAccumulatedMs: number;
}

export interface LiveRoomState {
  roomId: string;
  status: RoomStatus;
  activeItem: LiveItemState | null;
  bidders: RoomParticipant[];
  resolvedItems: ResolvedItem[];
}

export interface ResolvedItem {
  itemId: string;
  slotIndex: number;
  name: string;
  status: ItemStatus;
  winnerId: string | null;
  winnerName: string | null;
  winningBid: number | null;
  resolvedAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  text: string;
  sentAt: string;
}

export interface CreateRoomItemInput {
  name: string;
  description: string;
  imageUrl: string | null;
  startingPrice: number;
}

export interface CreateRoomInput {
  title: string;
  description?: string;
  perRoomBudget: number;
  minIncrement: number;
  itemDurationSeconds: number;
  items: CreateRoomItemInput[];
}