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
  CheckCircle2,
  Clock,
  Link2,
  Settings,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useSocket } from "@/hooks/use-socket";
import { useRoomState } from "@/hooks/use-room-state";
import { useSession } from "@/lib/auth-client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <Button
          asChild
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
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
      <header className="flex h-16 items-center justify-end border-b border-border bg-card px-6">
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

      {/* Main content */}
      <main className="flex flex-1 px-4 py-8 lg:px-10 lg:py-12">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[380px_1fr]">
          {/* Left: Room Info Card */}
          <div className="space-y-6">
            <div className="border border-border bg-card p-6">
              {/* Room code */}
              <div className="mb-4">
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Room Code
                </p>
                <h2 className="mt-1 font-display text-5xl font-bold text-primary">
                  #{roomDetail.code}
                </h2>
              </div>

              {/* Title & description */}
              <h3 className="font-display text-xl font-semibold text-foreground">
                {roomDetail.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {roomDetail.description || "No description provided."}
              </p>

              {/* Stats */}
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Lots
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-foreground">
                    {roomDetail.items.length}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Starting Bid
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-foreground">
                    $
                    {roomDetail.items[0]?.startingPrice?.toLocaleString() ??
                      "5K"}
                  </p>
                </div>
              </div>

              {/* Start button */}
              {canStart && (
                <Button
                  size="lg"
                  className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90"
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
                      Start Auction
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              )}

              {bidderCount < AUCTION_ROOM.MIN_BIDDERS_TO_START && canStart && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Waiting for host to initiate
                </p>
              )}
            </div>

            {/* Bottom actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={copyCode}
                className="border-border bg-transparent"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Copy Code
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="border-border bg-transparent"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>

          {/* Right: Participants */}
          <div>
            <div className="mb-6 flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Joined Participants
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {bidderCount} Ready
              </span>
            </div>

            {/* Code verification for non-participants */}
            {needsCode && (
              <div className="mb-6 border border-border bg-card p-6">
                <h4 className="mb-2 font-display text-base font-semibold text-foreground">
                  Join This Room
                </h4>
                <p className="mb-4 text-sm text-muted-foreground">
                  Enter the room code to join as a bidder.
                </p>
                <form onSubmit={handleJoinWithCode} className="flex gap-3">
                  <Input
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="Enter room code"
                    maxLength={4}
                    className="max-w-[200px] border-0 border-b border-border font-mono text-lg tracking-widest bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary"
                    required
                  />
                  <Button
                    type="submit"
                    disabled={joining}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
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
                  <Alert variant="destructive" className="mt-3 ">
                    <AlertDescription>{joinError}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Participant grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roomDetail.participants.length > 0 ? (
                roomDetail.participants.map((participant, index) => {
                  const isOnline = roomState?.bidders?.some(
                    (b) => b.userId === participant.userId,
                  );
                  const isCurrentUser =
                    participant.userId === session?.user?.id;
                  return (
                    <div
                      key={participant.userId}
                      className="flex items-center gap-3 border border-border bg-card p-4"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary">
                        {participant.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {participant.name}
                          {isCurrentUser && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (You)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bidder #{String(index + 1).padStart(3, "0")}
                        </p>
                      </div>
                      {isOnline ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      ) : (
                        <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center border border-dashed border-border py-12 text-center">
                  <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No participants yet. Share the code to invite bidders.
                  </p>
                </div>
              )}
            </div>

            {/* Error messages */}
            {(socketError || roomError) && (
              <Alert variant="destructive" className="mt-6 ">
                <AlertDescription>{socketError ?? roomError}</AlertDescription>
              </Alert>
            )}

            {/* Waiting message for bidders */}
            {!canStart && !needsCode && (
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Waiting for the auctioneer to start the auction…
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
