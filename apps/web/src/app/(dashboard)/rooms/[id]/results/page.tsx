"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, User } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useRoomState } from "@/hooks/use-room-state";
import { useSocket } from "@/hooks/use-socket";
import { Button } from "@/components/ui/button";
import type { ResolvedItem } from "@auction/shared";

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const router = useRouter();
  const { socket, authenticated } = useSocket();
  const { roomState } = useRoomState(authenticated ? socket : null, roomId);

  const {
    data: roomDetail,
    isLoading,
    isError,
  } = useQuery({
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
        <Button
          asChild
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const resolvedItems: ResolvedItem[] =
    results?.items ?? (roomState?.resolvedItems ?? []);

  const soldItems = resolvedItems.filter((i) => i.status === "SOLD");
  const totalRevenue = soldItems.reduce(
    (sum, item) => sum + (item.winningBid ?? 0),
    0,
  );

  const totalBids = results?.stats?.totalBids ?? 0;
  const participantCount = results?.stats?.participantCount ?? 0;
  const duration = results?.stats?.duration ?? "—";

  return (
    <div className="p-6 lg:p-10">
      {/* Status */}
      <div className="mb-8">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          AUCTION COMPLETED
        </span>
      </div>

      {/* Aggregate Stats */}
      <div className="mb-10 grid grid-cols-3 gap-4 border-b border-border pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Total Bids
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {totalBids}
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Participants
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {participantCount}
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Duration
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {duration}
          </p>
        </div>
      </div>

      {/* Total Revenue (only if there are sold items) */}
      {soldItems.length > 0 && (
        <div className="mb-10">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Total Revenue
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-foreground">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mb-10 space-y-3">
        <Button
          asChild
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Link href="/dashboard">BACK TO DASHBOARD</Link>
        </Button>
        <Button
          variant="outline"
          asChild
          className="w-full border-border bg-transparent"
        >
          <Link href="/dashboard">VIEW OTHER AUCTIONS</Link>
        </Button>
      </div>

      {/* Lot Results — stacked sections */}
      <div className="space-y-12 pb-10">
        {resolvedItems.map((item) => (
          <LotResultSection key={item.itemId} item={item} />
        ))}
      </div>
    </div>
  );
}

function LotResultSection({ item }: { item: ResolvedItem }) {
  const isSold = item.status === "SOLD";
  const lotNumber = String((item.slotIndex ?? 0) + 1).padStart(2, "0");

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Product image */}
      <div className="space-y-4">
        <div className="aspect-square overflow-hidden border border-border bg-muted">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
              <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Item label below image */}
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            LOT {lotNumber}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-foreground">
            {item.name}
          </h2>
          {item.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
      </div>

      {/* Right: Result details */}
      <div className="space-y-6">
        {/* Final Hammer Price */}
        <div className="bg-secondary p-6 text-secondary-foreground">
          <p className="font-mono text-xs uppercase tracking-wider text-white/60">
            Final Hammer Price
          </p>
          <p className="mt-2 font-display text-5xl font-bold text-white">
            ${item.winningBid?.toLocaleString() ?? "—"}
          </p>
          <div className="mt-4">
            <span
              className={`inline-flex items-center px-3 py-1 font-mono text-xs uppercase tracking-wider ${
                isSold
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isSold ? "SOLD" : "UNSOLD"}
            </span>
          </div>
        </div>

        {/* Winning Bidder */}
        <div className="border border-border bg-card p-6">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {isSold ? "Winning Bidder" : "Outcome"}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {isSold
                  ? item.winnerName ?? "Unknown"
                  : "No winning bid"}
              </p>
              {isSold && item.winningBid && (
                <p className="text-sm text-muted-foreground">
                  ${item.winningBid.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
