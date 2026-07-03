"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
 Loader2,
 Pause,
 Play,
 Clock,
 ArrowRight,
 ImageIcon,
 MessageSquare,
 X,
 Eye,
 LogOut,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useSocket } from "@/hooks/use-socket";
import { useRoomState } from "@/hooks/use-room-state";
import { useAuctionTimer } from "@/hooks/use-auction-timer";
import { useSession } from "@/lib/auth-client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function AuctionRoomPage() {
 const params = useParams<{ id: string }>();
 const roomId = params.id;
 const router = useRouter();
 const { data: session } = useSession();
 const { role } = useRole();
 const { socket, connected, authenticated, error: socketError } = useSocket();
 const {
  roomState,
  chatMessages,
  bidHistory,
  presence,
  error: roomError,
  placeBid,
  sendChat,
  pauseAuction,
  resumeAuction,
 } = useRoomState(authenticated ? socket : null, roomId);

 const [chatInput, setChatInput] = useState("");
 const [bidError, setBidError] = useState<string | null>(null);
 const [customBid, setCustomBid] = useState("");
 const [showChat, setShowChat] = useState(false);
 const chatScrollRef = useRef<HTMLDivElement>(null);

 const { data: roomDetail } = useQuery({
  queryKey: ["room", roomId],
  queryFn: () => apiClient.getRoom(roomId),
 });

 const activeItem = roomState?.activeItem;
 const { seconds, isExpired } = useAuctionTimer(
  activeItem?.endsAt ?? null,
  activeItem?.paused ?? false,
 );

  const userRole = role ?? "BIDDER";
  const isAuctioneer = userRole === "AUCTIONEER";
  const currentBidder = roomState?.bidders?.find(
   (b) => b.userId === session?.user?.id,
  );
  const isSpectator = !isAuctioneer && !currentBidder && roomState?.status === "AUCTION";
  const viewerCount = roomState?.spectatorIds?.length ?? 0;
  const availableBudget = currentBidder?.available ?? 0;

 const highBid = activeItem?.highBid;
 const highBidAmount = highBid?.amount ?? activeItem?.startingPrice ?? 0;
 const minIncrement = roomDetail?.minIncrement ?? 100;

 useEffect(() => {
  if (chatScrollRef.current) {
   chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }
 }, [chatMessages]);

 useEffect(() => {
  if (roomState?.status === "COMPLETED") {
   router.push(`/rooms/${roomId}/results`);
  }
  if (roomState?.status === "LOBBY") {
   router.push(`/rooms/${roomId}/lobby`);
  }
 }, [roomState?.status, roomId, router]);

 const minimumBid = highBid
  ? highBidAmount + minIncrement
  : activeItem?.startingPrice ?? 0;

 const quickIncrements = [
  { label: "+$500", amount: 500 },
  { label: "+$1K", amount: 1000 },
  { label: "+$5K", amount: 5000 },
 ];

 const nextBidAmount = highBidAmount + minIncrement;

 async function handleSubmitBid(amount: number) {
  setBidError(null);
  if (amount <= 0) {
   setBidError("Bid must be greater than zero.");
   return;
  }
  if (amount > availableBudget) {
   setBidError("Insufficient budget for this bid.");
   return;
  }
  const ack = await placeBid(amount);
  if (!ack.ok) {
   setBidError(ack.error.message);
  }
  setCustomBid("");
 }

 function handleQuickBid(amount: number) {
  handleSubmitBid(highBidAmount + amount);
 }

 function handleCustomBid(e: React.FormEvent) {
  e.preventDefault();
  handleSubmitBid(Number(customBid));
 }

 async function handleSendChat(e: React.FormEvent) {
  e.preventDefault();
  const text = chatInput.trim();
  if (!text) return;
  await sendChat(text);
  setChatInput("");
 }

 async function handlePause() {
  await pauseAuction();
 }

 async function handleResume() {
  await resumeAuction();
 }

 if (!connected || !authenticated || !roomState) {
  return (
   <div className="flex min-h-[60vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3">
     <Loader2 className="h-6 w-6 animate-spin text-primary" />
     <p className="text-sm text-muted-foreground">
      Connecting to auction room…
     </p>
     {(socketError || roomError) && (
      <Alert variant="destructive" className="max-w-md ">
       <AlertDescription>
        {socketError ?? roomError}
       </AlertDescription>
      </Alert>
     )}
    </div>
   </div>
  );
 }

 const isPaused = activeItem?.paused ?? false;
 const activeBidders = roomState.bidders?.filter((b) => b.role === "BIDDER") ?? [];

 return (
  <div className="flex h-[calc(100vh-64px)] flex-col">
   {/* Error banner */}
   {(socketError || roomError || bidError) && (
    <Alert variant="destructive" className="rounded-none">
     <AlertDescription>
      {bidError ?? socketError ?? roomError}
     </AlertDescription>
    </Alert>
   )}

    {/* Top info bar */}
    <div className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-4">
       <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-primary">
        <span className="h-2 w-2 rounded-full bg-primary" />
        LIVE NOW
       </span>
       <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        LOT {String((activeItem?.slotIndex ?? 0) + 1).padStart(2, "0")}
       </span>
       {viewerCount > 0 && (
        <span className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
         <Eye className="h-3 w-3" />
         {viewerCount} watching
        </span>
       )}
      </div>
      <div className="text-right">
       <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Current Bid
       </p>
       <p className="font-display text-2xl font-bold text-foreground">
        ${highBidAmount.toLocaleString()}
       </p>
      </div>
     </div>

   {/* Main content */}
   <div className="flex flex-1 overflow-hidden">
    {/* Left: Product image */}
    <div className="relative flex-1 bg-muted">
     {activeItem?.imageUrl ? (
      <img
       src={activeItem.imageUrl}
       alt={activeItem.name}
       className="h-full w-full object-cover"
      />
     ) : (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
       <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
      </div>
     )}

     {/* Timer overlay */}
     {activeItem && (
      <div className="absolute left-4 top-4">
       <div
        className={cn(
         "flex items-center gap-2 border px-3 py-1.5",
         isPaused
          ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
          : seconds <= 10
           ? "border-red-500/20 bg-red-500/10 text-red-600"
           : "border-border bg-card/90 text-foreground",
        )}
       >
        <Clock className="h-4 w-4" />
        <span className="font-mono text-sm font-semibold">
         {isPaused
          ? "PAUSED"
          : isExpired
           ? "EXPIRED"
           : `ENDS IN ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}
        </span>
       </div>
      </div>
     )}
    </div>

    {/* Right: Bid History */}
    <div className="flex w-80 flex-col border-l border-border bg-card">
     <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h3 className="font-display text-sm font-semibold">Bid History</h3>
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
       {bidHistory.length} BIDS
      </span>
     </div>

     <div className="flex-1 overflow-y-auto px-4 py-3">
      {bidHistory.length === 0 ? (
       <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
         No bids yet. Waiting for first bid…
        </p>
       </div>
      ) : (
       <div className="space-y-3">
        {[...bidHistory].reverse().map((bid, index) => (
         <div
          key={`${bid.placedAt}-${index}`}
          className="flex items-center justify-between"
         >
          <div className="flex items-center gap-2">
           {index === 0 && (
            <span className="h-2 w-2 rounded-full bg-primary" />
           )}
           <span className="text-sm font-medium">
            {bid.userId === session?.user?.id
             ? "You"
             : bid.userName}
           </span>
           <span className="text-xs text-muted-foreground">
            {index === 0
             ? "JUST NOW"
             : `${index}m ago`}
           </span>
          </div>
          <span className="font-display font-bold">
           ${bid.amount.toLocaleString()}
          </span>
         </div>
        ))}
       </div>
      )}
     </div>

     {/* Chat toggle */}
     <div className="border-t border-border p-3">
      <Button
       variant="outline"
       size="sm"
       className="w-full gap-2 border-border bg-transparent"
       onClick={() => setShowChat(!showChat)}
      >
       <MessageSquare className="h-4 w-4" />
       {showChat ? "Hide Chat" : "Open Chat"}
      </Button>
     </div>
    </div>
   </div>

    {/* Bottom bar */}
    <div className="flex items-center justify-between border-t border-border bg-card px-6 py-4">
    {/* Active bidders */}
    <div className="flex items-center gap-3">
     <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
      Active Bidders
     </span>
     <div className="flex -space-x-2">
      {activeBidders.slice(0, 4).map((bidder) => (
       <div
        key={bidder.userId}
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-semibold text-primary"
        title={bidder.name}
       >
        {bidder.name
         .split(" ")
         .map((w) => w[0])
         .join("")
         .toUpperCase()
         .slice(0, 2)}
       </div>
      ))}
      {activeBidders.length > 4 && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-xs font-semibold text-primary-foreground">
         +{activeBidders.length - 4}
        </div>
       )}
      </div>
      {!isAuctioneer && !isSpectator && (
        <div>
         <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Your Budget
         </p>
          <p className="font-display text-lg font-bold text-foreground">
           ${availableBudget.toLocaleString()}
          </p>
        </div>
       )}
     </div>

      {/* Bid controls */}
     <div className="flex items-center gap-4">
      {isSpectator ? (
       <>
        <span className="inline-flex items-center gap-1.5 bg-muted px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
         <Eye className="h-3 w-3" />
         SPECTATING
        </span>
        <Button
         variant="outline"
         onClick={() => router.push("/dashboard")}
         className="gap-2 border-border bg-transparent px-6"
        >
         <LogOut className="h-4 w-4" />
         LEAVE SPECTATE
        </Button>
       </>
      ) : (
       <>
        <Button
         variant="outline"
         className="border-border bg-transparent px-6"
         disabled
        >
         WATCH LOT
        </Button>

        {!isAuctioneer && (
         <>
          {highBid?.userId === session?.user?.id ? (
           <div className="bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            You are the highest bidder
           </div>
          ) : (
           <Button
            onClick={() => handleSubmitBid(nextBidAmount)}
            disabled={isPaused || isExpired}
            className="gap-2 bg-primary px-6 text-primary-foreground hover:bg-primary/90"
           >
            BID ${nextBidAmount.toLocaleString()}
            <ArrowRight className="h-4 w-4" />
           </Button>
          )}
         </>
        )}

        {isAuctioneer && (
         <Button
          variant="outline"
          onClick={isPaused ? handleResume : handlePause}
          className="border-border bg-transparent"
         >
          {isPaused ? (
           <>
            <Play className="mr-2 h-4 w-4" />
            RESUME
           </>
          ) : (
           <>
            <Pause className="mr-2 h-4 w-4" />
            PAUSE
           </>
          )}
         </Button>
        )}
       </>
      )}
     </div>

     {/* Quick increments */}
     {!isAuctioneer && !isSpectator && highBid?.userId !== session?.user?.id && (
      <div className="flex items-center gap-2">
       <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Quick Increments
       </span>
       {quickIncrements.map((inc) => (
        <Button
         key={inc.label}
         variant="outline"
         size="sm"
         disabled={isPaused || isExpired}
         onClick={() => handleQuickBid(inc.amount)}
         className="border-border bg-transparent text-xs"
        >
         {inc.label}
        </Button>
       ))}
      </div>
     )}
   </div>

   {/* Chat overlay */}
   {showChat && (
    <div className="absolute bottom-20 right-4 z-50 w-80 border border-border bg-card shadow-lg">
     <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h3 className="font-display text-sm font-semibold">Chat</h3>
      <button
       onClick={() => setShowChat(false)}
       className="text-muted-foreground hover:text-foreground"
      >
       <X className="h-4 w-4" />
      </button>
     </div>
     <div
      ref={chatScrollRef}
      className="h-64 overflow-y-auto px-4 py-3"
     >
      {chatMessages.length === 0 ? (
       <p className="text-center text-sm text-muted-foreground">
        No messages yet.
       </p>
      ) : (
       <div className="space-y-3">
        {chatMessages.map((msg) => (
         <div key={msg.id} className="flex gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">
           {msg.userName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
             <span className="text-xs font-medium">
              {msg.userId === session?.user?.id
               ? "You"
               : msg.userName}
             </span>
             {msg.isSpectator && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
               Spectator
              </span>
             )}
             <span className="text-xs text-muted-foreground">
              {new Date(msg.sentAt).toLocaleTimeString([], {
               hour: "2-digit",
               minute: "2-digit",
              })}
             </span>
            </div>
           <p className="text-sm text-foreground">{msg.text}</p>
          </div>
         </div>
        ))}
       </div>
      )}
     </div>
     <form
      onSubmit={handleSendChat}
      className="flex gap-2 border-t border-border p-3"
     >
      <Input
       value={chatInput}
       onChange={(e) => setChatInput(e.target.value)}
       placeholder="Type a message…"
       maxLength={280}
       className="border-0 border-b border-border bg-transparent text-sm outline-none ring-0 focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <Button
       type="submit"
       size="sm"
       disabled={!chatInput.trim()}
       className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
       Send
      </Button>
     </form>
    </div>
   )}
  </div>
 );
}
