import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoomSummary, RoomStatus } from "@auction/shared";

function StatusBadge({ status }: { status: RoomStatus }) {
  switch (status) {
    case "AUCTION":
      return (
        <span className="inline-flex items-center gap-1.5  bg-primary/10 px-2 py-1 font-mono text-xs uppercase tracking-wider text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          LIVE
        </span>
      );
    case "LOBBY":
      return (
        <span className="inline-flex items-center  bg-muted px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          UPCOMING
        </span>
      );
    case "COMPLETED":
      return (
        <span className="inline-flex items-center  bg-muted px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          COMPLETED
        </span>
      );
  }
}

interface AuctionCardProps {
  room: RoomSummary;
  viewerRole: "AUCTIONEER" | "BIDDER";
  isOwner?: boolean;
}

export function AuctionCard({ room, viewerRole, isOwner }: AuctionCardProps) {
  const isAuctioneer = viewerRole === "AUCTIONEER";
  const isLive = room.status === "AUCTION";
  const isCompleted = room.status === "COMPLETED";
  const isParticipant = room.isParticipant ?? false;

  const bidLabel = isCompleted
    ? "Final Bid"
    : isLive
      ? "Current Bid"
      : "Starting Bid";

  const bidValue = isCompleted
    ? "—"
    : `$${room.perRoomBudget.toLocaleString()}`;

  // Generate a random 4-digit lot number
  const lotNumber = String(Math.floor(1000 + Math.random() * 9000));

  return (
    <div className="group flex flex-col overflow-hidden  border border-border bg-card transition-all hover:border-primary/30">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {room.coverImageUrl ? (
          <img
            src={room.coverImageUrl}
            alt={room.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute left-3 top-3">
          <StatusBadge status={room.status} />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {room.title}
          </h3>
          <span className="shrink-0  bg-muted px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            LOT {lotNumber}
          </span>
        </div>

        {/* Bid info + action */}
        <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {bidLabel}
            </p>
            <p className="font-display text-xl font-bold text-foreground">
              {bidValue}
            </p>
          </div>

          {isAuctioneer || isOwner ? (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <Link
                href={
                  isCompleted
                    ? `/rooms/${room.id}/results`
                    : `/rooms/${room.id}/lobby`
                }
              >
                {isCompleted ? "VIEW RESULTS" : "MANAGE"}
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={isCompleted}
              asChild={!isCompleted}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isCompleted ? (
                <span>ENDED</span>
              ) : isLive && !isParticipant ? (
                <Link href={`/rooms/${room.id}/auction`}>SPECTATE</Link>
              ) : isLive ? (
                <Link href={`/rooms/${room.id}/auction`}>JOIN ROOM</Link>
              ) : (
                <Link href={`/rooms/${room.id}/join`}>JOIN ROOM</Link>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
