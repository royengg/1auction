import { z } from "zod";
import { LIMITS } from "../constants.js";

export const roleSchema = z.enum(["AUCTIONEER", "BIDDER"]);
export const roomStatusSchema = z.enum(["LOBBY", "AUCTION", "COMPLETED"]);
export const itemStatusSchema = z.enum(["PENDING", "ACTIVE", "SOLD", "UNSOLD"]);

export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  activeRole: roleSchema,
  createdAt: z.string(),
});

export const roomParticipantSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  role: roleSchema,
  budget: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  available: z.number().int().nonnegative(),
  spent: z.number().int().nonnegative(),
});

export const auctionItemSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  slotIndex: z.number().int().nonnegative(),
  name: z.string().min(1).max(LIMITS.ITEM_NAME_MAX),
  description: z.string().max(LIMITS.ITEM_DESCRIPTION_MAX),
  imageUrl: z.string().url().nullable(),
  startingPrice: z.number().int().nonnegative(),
  status: itemStatusSchema,
  winnerId: z.string().nullable(),
  winningBid: z.number().int().nonnegative().nullable(),
});

export const roomSummarySchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1).max(LIMITS.ROOM_TITLE_MAX),
  description: z.string(),
  status: roomStatusSchema,
  auctioneerId: z.string().min(1),
  auctioneerName: z.string().min(1),
  itemCount: z.number().int().nonnegative(),
  bidderCount: z.number().int().nonnegative(),
  perRoomBudget: z.number().int().positive(),
  minIncrement: z.number().int().positive(),
  createdAt: z.string(),
});

export const createRoomInputSchema = z
  .object({
    title: z.string().min(1).max(LIMITS.ROOM_TITLE_MAX),
    description: z.string().max(500).optional(),
    perRoomBudget: z.number().int().positive(),
    minIncrement: z.number().int().positive(),
    itemDurationSeconds: z.number().int().positive(),
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(LIMITS.ITEM_NAME_MAX),
          description: z.string().max(LIMITS.ITEM_DESCRIPTION_MAX),
          imageUrl: z.string().url().nullable().optional(),
          startingPrice: z.number().int().nonnegative(),
        }),
      )
      .min(1)
      .max(50),
  })
  .strict();

export const joinRoomInputSchema = z.object({
  code: z.string().min(1).max(20),
});

export const placeBidPayloadSchema = z.object({
  roomId: z.string().min(1),
  amount: z.number().int().positive(),
});

export const sendChatPayloadSchema = z.object({
  roomId: z.string().min(1),
  text: z.string().min(1).max(LIMITS.CHAT_MESSAGE_MAX),
});

export const liveBidSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1),
  amount: z.number().int().positive(),
  placedAt: z.string(),
});

export const liveItemStateSchema = z.object({
  itemId: z.string().min(1),
  slotIndex: z.number().int().nonnegative(),
  name: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  startingPrice: z.number().int().nonnegative(),
  status: itemStatusSchema,
  highBid: liveBidSchema.nullable(),
  endsAt: z.number().int().nullable(),
  paused: z.boolean(),
  pausedAccumulatedMs: z.number().int().nonnegative(),
});

export const resolvedItemSchema = z.object({
  itemId: z.string().min(1),
  slotIndex: z.number().int().nonnegative(),
  name: z.string().min(1),
  status: itemStatusSchema,
  winnerId: z.string().nullable(),
  winnerName: z.string().nullable(),
  winningBid: z.number().int().nullable(),
  resolvedAt: z.string(),
});

export const liveRoomStateSchema = z.object({
  roomId: z.string().min(1),
  status: roomStatusSchema,
  activeItem: liveItemStateSchema.nullable(),
  bidders: z.array(roomParticipantSchema),
  resolvedItems: z.array(resolvedItemSchema),
});