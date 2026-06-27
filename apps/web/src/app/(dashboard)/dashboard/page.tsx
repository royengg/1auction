"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Gavel, TrendingUp, Wallet, Trophy } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatsCard } from "@/components/shared/stats-card";
import { AuctionCard } from "@/components/shared/auction-card";

export default function DashboardPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useRole();
  const { data: session } = useSession();

  const [codeInput, setCodeInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => apiClient.listRooms(),
    enabled: !roleLoading && !!role,
  });

  if (roleLoading || !role) return null;

  const isAuctioneer = role === "AUCTIONEER";
  const rooms = data?.rooms ?? [];

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiClient.getStats(),
    enabled: !isAuctioneer,
  });

  async function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    const code = codeInput.trim();

    const targetRoom = data?.rooms?.find(
      (r) => r.code.toLowerCase() === code.toLowerCase(),
    );
    if (!targetRoom) {
      setJoinError(
        "No room found with that code. Check the code and try again.",
      );
      return;
    }

    setJoining(true);
    try {
      if (targetRoom.status === "AUCTION") {
        router.push(`/rooms/${targetRoom.id}/auction`);
      } else {
        await apiClient.joinRoom(targetRoom.id, code);
        router.push(`/rooms/${targetRoom.id}/lobby`);
      }
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join room.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {isAuctioneer ? "Auctioneer Control" : "Bidder Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAuctioneer
              ? "Manage your auctions, create new rooms, and review past results."
              : "Browse public auctions, join with a code, and track your bids."}
          </p>
        </div>
        {isAuctioneer && (
          <Button onClick={() => router.push("/rooms/new")}>
            <Gavel className="mr-2 h-4 w-4" />
            Create New Auction
          </Button>
        )}
      </div>

      {/* Bidder direct access */}
      {!isAuctioneer && (
        <div className="mb-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Direct Access
            </h2>
            <form
              onSubmit={handleJoinByCode}
              className="mt-3 flex items-center gap-3"
            >
              <Input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Enter room code"
                maxLength={4}
                className="max-w-[200px] font-mono text-lg tracking-widest"
                required
              />
              <Button type="submit" disabled={joining}>
                Join Room
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
            {joinError && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{joinError}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isAuctioneer ? (
          <>
            <StatsCard
              label="My Auctions"
              value={
                rooms.filter((r) => r.auctioneerId === session?.user?.id).length
              }
              icon={<Gavel className="h-5 w-5" />}
            />
            <StatsCard
              label="Active Rooms"
              value={rooms.filter((r) => r.status === "AUCTION").length}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatsCard
              label="Completed"
              value={rooms.filter((r) => r.status === "COMPLETED").length}
              icon={<Trophy className="h-5 w-5" />}
            />
          </>
        ) : (
          <>
            <StatsCard
              label="Active Bids"
              value={stats?.activeBids ?? 0}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatsCard
              label="Won Items"
              value={stats?.wonItems ?? 0}
              icon={<Trophy className="h-5 w-5" />}
            />
            <StatsCard
              label="Total Exposure"
              value={`$${(stats?.totalExposure ?? 0).toLocaleString()}`}
              icon={<Wallet className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      {/* Publicly listed auctions */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">
          {isAuctioneer ? "All Auctions" : "Publicly Listed Auctions"}
        </h2>
        <button className="text-sm text-muted-foreground hover:text-foreground">
          View All
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[340px] animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">
            {isAuctioneer
              ? "No auctions yet. Create your first auction to get started."
              : "No active auctions right now. Check back soon or join with a code."}
          </p>
          {isAuctioneer && (
            <Button className="mt-4" onClick={() => router.push("/rooms/new")}>
              <Gavel className="mr-2 h-4 w-4" />
              Create Auction
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <AuctionCard
              key={room.id}
              room={room}
              viewerRole={role}
              isOwner={room.auctioneerId === session?.user?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
