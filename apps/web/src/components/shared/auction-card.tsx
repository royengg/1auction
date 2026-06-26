import Link from "next/link";
import { Lock, Users, Clock, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoomSummary, RoomStatus } from "@auction/shared";

function statusBadge(status: RoomStatus) {
  switch (status) {
    case "AUCTION":
      return <Badge variant="live">LIVE</Badge>;
    case "LOBBY":
      return <Badge variant="warning">UPCOMING</Badge>;
    case "COMPLETED":
      return <Badge variant="muted">COMPLETED</Badge>;
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

  const bidLabel = room.status === "COMPLETED"
    ? "Final Bid"
    : room.status === "AUCTION"
      ? "Current Bid"
      : "Starting Price";

  const bidValue = room.status === "LOBBY"
    ? room.perRoomBudget
    : room.perRoomBudget;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/30">
      {/* Image / placeholder */}
      <div className="relative h-44 overflow-hidden bg-muted">
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          <span className="font-display text-4xl font-bold text-muted-foreground/20">
            {room.title.slice(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Top badges */}
        <div className="absolute left-3 top-3 flex gap-2">
          {statusBadge(room.status)}
        </div>
        <div className="absolute right-3 top-3">
          <Badge variant="muted">BIDDING</Badge>
        </div>

        {/* Auctioneer lock overlay */}
        {isAuctioneer && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex flex-col items-center gap-2">
              <Lock className="h-6 w-6 text-foreground" />
              <span className="text-sm font-medium text-foreground">
                Admin Lock
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {room.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {room.description || "No description provided."}
        </p>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {room.bidderCount} / 6
          </span>
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            {room.itemCount} items
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {isLive ? "Live now" : "Scheduled"}
          </span>
        </div>

        {/* Bid info + action */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <div>
            <p className="font-mono text-xs uppercase text-muted-foreground">
              {bidLabel}
            </p>
            <p className="font-display text-xl font-bold text-primary">
              ${bidValue.toLocaleString()}
            </p>
          </div>
          {isAuctioneer || isOwner ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={
                  room.status === "COMPLETED"
                    ? `/rooms/${room.id}/results`
                    : `/rooms/${room.id}/lobby`
                }
              >
                {room.status === "COMPLETED" ? "View Results" : "Preview Room"}
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={room.status === "COMPLETED"}
              asChild={room.status !== "COMPLETED"}
            >
              {room.status === "COMPLETED" ? (
                <span>Ended</span>
              ) : isLive ? (
                <Link href={`/rooms/${room.id}/auction`}>Join Room</Link>
              ) : (
                <Link href={`/rooms/${room.id}/join`}>Join Room</Link>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}