"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Home, Activity, Clock, Users } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useRoomState } from "@/hooks/use-room-state";
import { useSocket } from "@/hooks/use-socket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ResolvedItem } from "@auction/shared";

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const router = useRouter();
  const { socket, authenticated } = useSocket();
  const { roomState } = useRoomState(authenticated ? socket : null, roomId);

  const { data: roomDetail, isLoading, isError } = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => apiClient.getRoom(roomId),
  });

  const { data: results } = useQuery({
    queryKey: ["results", roomId],
    queryFn: () => apiClient.getResults(roomId),
  });

  useEffect(() => {
    if (roomState?.status === "AUCTION") {
      router.push(`/rooms/${roomId}/auction`);
    }
    if (roomState?.status === "LOBBY") {
      router.push(`/rooms/${roomId}/lobby`);
    }
  }, [roomState?.status, roomId, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading results…</p>
      </div>
    );
  }

  if (isError || !roomDetail) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground">
          Room Not Found
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          This auction room no longer exists. It may have been deleted by the
          auctioneer or removed from the system.
        </p>
        <Button asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const resolvedItems: ResolvedItem[] =
    (results && results.length > 0)
      ? results
      : (roomState?.resolvedItems ?? []);

  const soldItems = resolvedItems.filter((i) => i.status === "SOLD");
  const totalRevenue = soldItems.reduce(
    (sum, item) => sum + (item.winningBid ?? 0),
    0,
  );

  return (
    <div className="p-6 lg:p-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Status banner */}
      <div className="mb-8 flex flex-col items-center text-center">
        <Badge variant="success" className="mb-4 gap-2 px-4 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          AUCTION OFFICIAL FINALIZED
        </Badge>
        <h1 className="font-display text-4xl font-bold text-foreground">
          {soldItems.length > 0 ? "SOLD" : "AUCTION COMPLETE"}
        </h1>
        {soldItems.length > 0 && (
          <p className="mt-2 text-lg text-muted-foreground">
            Total Revenue:{" "}
            <span className="font-display font-bold text-primary">
              ${totalRevenue.toLocaleString()}
            </span>
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Total Items Sold
            </span>
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {soldItems.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            of {resolvedItems.length} total
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Participants
            </span>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {roomDetail.participants.filter((p) => p.role === "BIDDER").length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            active bidders
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Total Revenue
            </span>
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            ${totalRevenue.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            from {soldItems.length} items sold
          </p>
        </div>
      </div>

      {/* Results list */}
      <h2 className="mb-4 font-display text-xl font-bold text-foreground">
        Final Results
      </h2>

      {resolvedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Clock className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            No results available yet. The auction may still be in progress.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {resolvedItems.map((item, index) => (
            <div
              key={item.itemId}
              className={`overflow-hidden rounded-lg border bg-card ${
                item.status === "SOLD"
                  ? "border-emerald-500/20"
                  : "border-border"
              }`}
            >
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                {/* Item icon / number */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <span className="font-display text-xl font-bold text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Item info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-foreground">
                      {item.name}
                    </h3>
                    <Badge
                      variant={item.status === "SOLD" ? "success" : "muted"}
                    >
                      {item.status}
                    </Badge>
                  </div>
                  {item.status === "SOLD" && item.winnerName && (
                    <>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Winner:{" "}
                        <span className="font-medium text-foreground">
                          {item.winnerName}
                        </span>
                      </p>
                      <p className="mt-1 font-display text-2xl font-bold text-primary">
                        ${item.winningBid?.toLocaleString()}
                      </p>
                    </>
                  )}
                  {item.status === "UNSOLD" && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      No bids were placed on this item
                    </p>
                  )}
                </div>

                {/* Hammer price */}
                {item.status === "SOLD" && (
                  <div className="text-right">
                    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Hammer Dropped
                    </p>
                    <p className="font-display text-xl font-bold text-foreground">
                      ${item.winningBid?.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Separator className="my-8" />

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        <Button asChild>
          <Link href="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            Return to Dashboard
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            View Live Auctions
          </Link>
        </Button>
      </div>
    </div>
  );
}