"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Pause, Play, Clock, TrendingUp } from "lucide-react";

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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

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

  const quickBids = [
    minimumBid,
    minimumBid + minIncrement,
    minimumBid + minIncrement * 4,
  ];

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
    handleSubmitBid(amount);
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
            <Alert variant="destructive" className="max-w-md">
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

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Error banner */}
      {(socketError || roomError || bidError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {bidError ?? socketError ?? roomError}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4">
        {/* Main auction area */}
        <div className="flex-1 space-y-4">
          {/* Item display card */}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {/* Image */}
            <div className="relative h-64 w-full overflow-hidden bg-muted lg:h-80">
              {activeItem?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeItem.imageUrl}
                  alt={activeItem.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                  <span className="font-display text-6xl font-bold text-muted-foreground/20">
                    {activeItem?.name?.slice(0, 2).toUpperCase() ?? "??"}
                  </span>
                </div>
              )}

              {/* LIVE badge */}
              <div className="absolute left-4 top-4">
                <Badge variant="live" className="gap-1.5 px-3 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  LIVE
                </Badge>
              </div>

              {/* Timer */}
              {activeItem && (
                <div className="absolute right-4 top-4">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-1.5",
                      isPaused
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                        : seconds <= 10
                          ? "border-red-500/20 bg-red-500/10 text-red-400"
                          : "border-border bg-card text-foreground",
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

            {/* Item details */}
            <div className="p-6">
              {activeItem ? (
                <>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    {activeItem.name}
                  </h2>
                  <div className="mt-6 flex items-end justify-between border-t border-border pt-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Current Bid
                      </p>
                      <p className="font-display text-3xl font-bold text-primary">
                        ${highBidAmount.toLocaleString()}
                      </p>
                      {highBid && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          by {highBid.userName}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Your Budget
                      </p>
                      <p className="font-display text-xl font-bold text-foreground">
                        ${availableBudget.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Bid controls */}
                  {!isAuctioneer && (
                    <div className="mt-6 space-y-4">
                      {highBid?.userId === session?.user?.id ? (
                        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-4 text-center">
                          <p className="text-sm font-medium text-amber-400">
                            You are the highest bidder
                          </p>
                          <p className="mt-1 text-xs text-amber-400/70">
                            Wait for another bidder to outbid you before placing a new bid
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Quick bid buttons */}
                          <div className="flex gap-2">
                            {quickBids.map((amount, i) => (
                              <Button
                                key={i}
                                variant="outline"
                                className="flex-1"
                                disabled={isPaused || isExpired}
                                onClick={() => handleQuickBid(amount)}
                              >
                                +${(amount - highBidAmount).toLocaleString()}
                              </Button>
                            ))}
                          </div>

                          {/* Custom bid */}
                          <form onSubmit={handleCustomBid} className="flex gap-2">
                            <Input
                              type="number"
                              min={minimumBid}
                              value={customBid}
                              onChange={(e) => setCustomBid(e.target.value)}
                              placeholder={`Minimum: $${minimumBid.toLocaleString()}`}
                              disabled={isPaused || isExpired}
                              className="flex-1"
                            />
                            <Button
                              type="submit"
                              disabled={
                                isPaused ||
                                isExpired ||
                                !customBid ||
                                Number(customBid) < minimumBid
                              }
                            >
                              Place Bid
                            </Button>
                          </form>
                        </>
                      )}
                    </div>
                  )}

                  {/* Auctioneer controls */}
                  {isAuctioneer && (
                    <div className="mt-6 flex gap-2">
                      {isPaused ? (
                        <Button
                          onClick={handleResume}
                          className="w-full"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Resume Auction
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={handlePause}
                          className="w-full"
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause Auction
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Waiting for next item…
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Resolved items summary */}
          {roomState.resolvedItems.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 font-display text-sm font-semibold">
                Completed Items ({roomState.resolvedItems.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {roomState.resolvedItems.map((item) => (
                  <Badge
                    key={item.itemId}
                    variant={item.status === "SOLD" ? "success" : "muted"}
                  >
                    {item.name}: {item.status === "SOLD" ? `SOLD $${item.winningBid?.toLocaleString()}` : "UNSOLD"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar - Activity / Chat */}
        <div className="w-full max-w-sm space-y-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4 pb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">
                  {(presence?.length ?? 0) > 0 ? presence?.length : roomState?.bidders?.length ?? 0}{" "}
                  Participants
                </h3>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <Tabs defaultValue="activity" className="w-full">
              <div className="px-3 pt-3">
                <TabsList className="w-full">
                  <TabsTrigger value="activity" className="flex-1">
                    Activity
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="flex-1">
                    Chat
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Activity tab */}
              <TabsContent
                value="activity"
                className="m-0 max-h-[400px] overflow-y-auto p-3"
              >
                {bidHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      No bids yet. Waiting for first bid…
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...bidHistory].reverse().map((bid, index) => (
                      <div
                        key={`${bid.placedAt}-${index}`}
                        className={cn(
                          "flex items-center gap-3 rounded-md p-2",
                          bid.userId === session?.user?.id
                            ? "bg-primary/10"
                            : "bg-background",
                        )}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">
                          {bid.userName
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {bid.userId === session?.user?.id
                              ? "You"
                              : bid.userName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(bid.placedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </p>
                        </div>
                        <p className="font-display text-lg font-bold text-primary">
                          ${bid.amount.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Chat tab */}
              <TabsContent value="chat" className="m-0">
                <div
                  ref={chatScrollRef}
                  className="max-h-[350px] overflow-y-auto p-3"
                >
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        No messages yet. Start the conversation.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="flex gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">
                            {msg.userName
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium">
                                {msg.userId === session?.user?.id
                                  ? "You"
                                  : msg.userName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(msg.sentAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground">
                              {msg.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Separator />
                <form
                  onSubmit={handleSendChat}
                  className="flex gap-2 p-3"
                >
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message…"
                    maxLength={280}
                  />
                  <Button type="submit" size="sm" disabled={!chatInput.trim()}>
                    Send
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          {/* Bidders list */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 font-display text-sm font-semibold">
              Bidders
            </h3>
            <div className="space-y-2">
              {roomState.bidders
                .filter((b) => b.role === "BIDDER")
                .map((bidder) => (
                  <div
                    key={bidder.userId}
                    className="flex items-center justify-between rounded-md bg-background px-3 py-2"
                  >
                    <span className="text-sm font-medium">
                      {bidder.userId === session?.user?.id
                        ? "You"
                        : bidder.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      ${bidder.available.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}