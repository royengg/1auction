"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ImageIcon, User } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useRoomState } from "@/hooks/use-room-state";
import { useSocket } from "@/hooks/use-socket";
import { Button } from "@/components/ui/button";
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
    <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
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

 // Get first sold item for display
 const displayItem = soldItems[0] ?? resolvedItems[0];
 const participantCount = roomDetail.participants.filter((p) => p.role === "BIDDER").length;

 // Calculate duration (mock for now, would need actual start/end times)
 const duration = "4h 12m";

 return (
  <div className="p-6 lg:p-10">
   {/* Status */}
   <div className="mb-8">
    <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-primary">
     <span className="h-2 w-2 rounded-full bg-primary" />
     AUCTION COMPLETED
    </span>
   </div>

   {/* Main content */}
   <div className="grid gap-8 lg:grid-cols-2">
    {/* Left: Product image */}
    <div className="space-y-6">
     <div className="aspect-square overflow-hidden border border-border bg-muted">
      {displayItem ? (
       <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
        <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
       </div>
      ) : (
       <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
        <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
       </div>
      )}
     </div>

     {/* Item details */}
     {displayItem && (
      <div>
       <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        LOT {String((displayItem.slotIndex ?? 0) + 1).padStart(2, "0")}
       </p>
       <h2 className="mt-1 font-display text-3xl font-bold text-foreground">
        {displayItem.name}
       </h2>
       <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        An exceptional example of mid-century horology. This mechanical chronograph
        features original patina, unpolished case, and fully serviced manual-wind
        movement. Provenance included.
       </p>
      </div>
     )}
    </div>

    {/* Right: Results */}
    <div className="space-y-6">
     {/* Final Hammer Price */}
     <div className="bg-secondary p-6 text-secondary-foreground">
      <p className="font-mono text-xs uppercase tracking-wider text-white/60">
       Final Hammer Price
      </p>
      <p className="mt-2 font-display text-5xl font-bold text-white">
       ${totalRevenue.toLocaleString()}
      </p>
      <div className="mt-4">
       <span className="inline-flex items-center bg-primary px-3 py-1 font-mono text-xs uppercase tracking-wider text-primary-foreground">
        SOLD
       </span>
      </div>
     </div>

     {/* Winning Bidder */}
     {soldItems.length > 0 && soldItems[0]?.winnerName && (
      <div className="border border-border bg-card p-6">
       <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Winning Bidder
       </p>
       <div className="mt-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
         <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
         <p className="font-medium text-foreground">
          {soldItems[0].winnerName}
         </p>
         <p className="text-sm text-muted-foreground">
          United Kingdom
         </p>
        </div>
       </div>
      </div>
     )}

     {/* Stats */}
     <div className="grid grid-cols-3 gap-4">
      <div className="border-t border-border pt-4">
       <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Total Bids
       </p>
       <p className="mt-1 font-display text-2xl font-bold text-foreground">
        47
       </p>
      </div>
      <div className="border-t border-border pt-4">
       <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Participants
       </p>
       <p className="mt-1 font-display text-2xl font-bold text-foreground">
        {participantCount}
       </p>
      </div>
      <div className="border-t border-border pt-4">
       <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Duration
       </p>
       <p className="mt-1 font-display text-2xl font-bold text-foreground">
        {duration}
       </p>
      </div>
     </div>

     {/* Final Bids */}
     {resolvedItems.length > 0 && (
      <div>
       <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
        <h3 className="font-display text-sm font-semibold">Final Bids</h3>
        <button className="font-mono text-xs uppercase tracking-wider text-primary hover:underline">
         Full Transcript
        </button>
       </div>
       <div className="space-y-3">
        {resolvedItems.slice(0, 4).map((item, index) => (
         <div key={item.itemId} className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
           {item.winnerName ?? `Bidder #${String(index + 1).padStart(4, "0")}`}
          </span>
          <span className="font-display font-bold">
           ${item.winningBid?.toLocaleString() ?? "—"}
          </span>
         </div>
        ))}
       </div>
      </div>
     )}

     {/* Actions */}
     <div className="space-y-3 pt-4">
      <Button
       asChild
       className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
       <Link href="/dashboard">
        BACK TO DASHBOARD
       </Link>
      </Button>
      <Button
       variant="outline"
       asChild
       className="w-full border-border bg-transparent"
      >
       <Link href="/dashboard">
        VIEW OTHER AUCTIONS
       </Link>
      </Button>
     </div>
    </div>
   </div>
  </div>
 );
}
