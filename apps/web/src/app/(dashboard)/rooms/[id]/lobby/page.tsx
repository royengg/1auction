"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  LogOut,
  Users,
  Copy,
  Check,
  Play,
  ArrowRight,
  Trash2,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useSocket } from "@/hooks/use-socket";
import { useRoomState } from "@/hooks/use-room-state";
import { useSession } from "@/lib/auth-client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AUCTION_ROOM } from "@auction/shared";

export default function LobbyPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { role } = useRole();
  const { socket, connected, authenticated, error: socketError } = useSocket();
  const {
    roomState,
    error: roomError,
    startAuction,
  } = useRoomState(authenticated ? socket : null, roomId);

  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  const {
    data: roomDetail,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => apiClient.getRoom(roomId),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  const userRole = role ?? "BIDDER";
  const isAuctioneer = userRole === "AUCTIONEER";
  const isOwner = roomDetail?.auctioneerId === session?.user?.id;

  // Check if current user is already a participant
  const isParticipant = roomDetail?.participants.some(
    (p) => p.userId === session?.user?.id,
  );

  const needsCode = !isOwner && !isParticipant && !hasJoined;

  useEffect(() => {
    if (roomState?.status === "AUCTION") {
      router.push(`/rooms/${roomId}/auction`);
    }
    if (roomState?.status === "COMPLETED") {
      router.push(`/rooms/${roomId}/results`);
    }
  }, [roomState?.status, roomId, router]);

  function copyCode() {
    if (!roomDetail) return;
    navigator.clipboard.writeText(roomDetail.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleJoinWithCode(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    const code = codeInput.trim();
    if (!code) {
      setJoinError("Please enter the room code.");
      return;
    }
    setJoining(true);
    try {
      await apiClient.joinRoom(roomId, code);
      setHasJoined(true);
      // Invalidate room query to refresh participant list
      queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Invalid room code.");
    } finally {
      setJoining(false);
    }
  }

  async function handleStart() {
    setStarting(true);
    try {
      await startAuction();
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel() {
    if (
      !confirm(
        "Are you sure you want to cancel this auction? This will delete the room and all associated data.",
      )
    ) {
      return;
    }
    setCancelling(true);
    try {
      await apiClient.cancelAuction(roomId);
      router.push("/dashboard");
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Failed to cancel auction.",
      );
    } finally {
      setCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !roomDetail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
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

  const bidderCount = roomDetail.participants.filter(
    (p) => p.role === "BIDDER",
  ).length;

  const canStart = isOwner || isAuctioneer;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
        {/* <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
          1auction
        </h1> */}
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Cancel Auction
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <LogOut className="mr-2 h-4 w-4" />
              Leave Lobby
            </Link>
          </Button>
        </div>
      </header>

      {/* Centered content */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-8">
          {/* Status badge */}
          <div className="flex justify-center">
            <Badge variant="success" className="gap-2 px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              LOBBY OPEN
            </Badge>
          </div>

          {/* Room code */}
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Access Code
            </p>
            <button
              onClick={copyCode}
              className="mt-2 inline-flex items-center gap-3 transition-colors hover:text-primary"
            >
              <h2 className="font-display text-6xl font-bold tracking-wider text-foreground">
                #{roomDetail.code}
              </h2>
              {copied ? (
                <Check className="h-6 w-6 text-primary" />
              ) : (
                <Copy className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <p className="mt-2 text-sm text-muted-foreground">
              Share this code with participants to grant access
            </p>
          </div>

          {/* Code verification overlay for non-participants */}
          {needsCode && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
                Join This Room
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Enter the room code to join as a bidder.
              </p>
              <form onSubmit={handleJoinWithCode} className="flex gap-3">
                <Input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="Enter room code"
                  maxLength={4}
                  className="max-w-[200px] font-mono text-lg tracking-widest"
                  required
                />
                <Button type="submit" disabled={joining}>
                  {joining ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Joining…
                    </>
                  ) : (
                    <>
                      Join Room
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
              {joinError && (
                <Alert variant="destructive" className="mt-3">
                  <AlertDescription>{joinError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Joined participants */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-display text-sm font-semibold">
                  Joined Participants
                </h3>
              </div>
              <span className="font-mono text-sm text-muted-foreground">
                {
                  roomDetail.participants.filter((p) => p.role === "BIDDER")
                    .length
                }{" "}
                / {roomDetail.maxBidders} READY
              </span>
            </div>

            {roomDetail.participants.length > 0 ? (
              <div className="space-y-3">
                {roomDetail.participants.map((participant) => {
                  const isOnline = roomState?.bidders?.some(
                    (b) => b.userId === participant.userId,
                  );
                  return (
                    <div
                      key={participant.userId}
                      className="flex items-center gap-3 rounded-md bg-background p-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary">
                        {participant.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {participant.name}
                          {participant.userId === session?.user?.id && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (You)
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`relative inline-flex h-2 w-2 rounded-full ${
                              isOnline ? "bg-emerald-500" : "bg-slate-600"
                            }`}
                          >
                            {isOnline && (
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {isOnline ? "Online" : "Joined"}
                          </span>
                        </div>
                      </div>
                      {participant.role === "AUCTIONEER" && (
                        <Badge variant="warning">HOST</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No participants yet. Share the code to invite bidders.
                </p>
              </div>
            )}
          </div>

          {/* Items preview */}
          {roomDetail.items.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="mb-3 font-display text-sm font-semibold">
                Auction Items ({roomDetail.items.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {roomDetail.items.map((item, index) => (
                  <Badge key={item.id} variant="muted">
                    {String(index + 1).padStart(2, "0")}. {item.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Error messages */}
          {(socketError || roomError) && (
            <Alert variant="destructive">
              <AlertDescription>{socketError ?? roomError}</AlertDescription>
            </Alert>
          )}

          {/* Start button */}
          {canStart ? (
            <div className="flex flex-col items-center gap-3">
              <Button
                size="lg"
                className="w-full max-w-md"
                onClick={handleStart}
                disabled={
                  starting ||
                  !connected ||
                  !authenticated ||
                  bidderCount < AUCTION_ROOM.MIN_BIDDERS_TO_START
                }
              >
                {starting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Starting Auction…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Start Auction
                  </>
                )}
              </Button>
              {bidderCount < AUCTION_ROOM.MIN_BIDDERS_TO_START && (
                <p className="text-sm text-muted-foreground">
                  At least {AUCTION_ROOM.MIN_BIDDERS_TO_START} bidder is
                  required to start
                </p>
              )}
              {!connected && (
                <p className="text-sm text-muted-foreground">
                  Connecting to server…
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              {needsCode ? (
                <p className="text-sm text-muted-foreground">
                  Enter the room code above to join this auction.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Waiting for the auctioneer to start the auction…
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
