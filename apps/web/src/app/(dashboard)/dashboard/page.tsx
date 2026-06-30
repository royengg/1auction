"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";

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

 const myRooms = rooms.filter((r) => r.auctioneerId === session?.user?.id);
 const activeRooms = myRooms.filter((r) => r.status === "AUCTION");
 const completedRooms = myRooms.filter((r) => r.status === "COMPLETED");

 return (
  <div className="p-6 lg:p-10">
   {/* Header */}
   <div className="mb-8 flex items-center justify-between">
    <div>
     <h1 className="font-display text-4xl font-bold text-foreground">
      {isAuctioneer ? "Your Auctions" : "Bidder Dashboard"}
     </h1>
     <p className="mt-1 text-sm text-muted-foreground">
      {isAuctioneer
       ? "Manage your active listings and past results."
       : "Browse public auctions, join with a code, and track your bids."}
     </p>
    </div>
    {isAuctioneer && (
     <Button
      onClick={() => router.push("/rooms/new")}
      className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
     >
      <Plus className="h-4 w-4" />
      CREATE NEW AUCTION
     </Button>
    )}
   </div>

   {/* Bidder direct access */}
   {!isAuctioneer && (
    <div className="mb-8">
     <div className="border border-border bg-card p-5">
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
        className="max-w-[200px] border-0 border-b border-border font-mono text-lg tracking-widest bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary"
        required
       />
       <Button type="submit" disabled={joining} className="bg-primary text-primary-foreground hover:bg-primary/90">
        Join Room
        <ArrowRight className="ml-2 h-4 w-4" />
       </Button>
      </form>
      {joinError && (
       <Alert variant="destructive" className="mt-3 ">
        <AlertDescription>{joinError}</AlertDescription>
       </Alert>
      )}
     </div>
    </div>
   )}

   {/* Stats row */}
   <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {isAuctioneer ? (
     <>
      <StatsCard
       label="Active Lots"
       value={activeRooms.length}
      />
      <StatsCard
       label="Total Bids Today"
       value={348}
      />
      <StatsCard
       label="Current Value"
       value="$142,500"
      />
      <StatsCard
       label="Success Rate"
       value="94%"
      />
     </>
    ) : (
     <>
      <StatsCard
       label="Active Bids"
       value={stats?.activeBids ?? 0}
      />
      <StatsCard
       label="Won Items"
       value={stats?.wonItems ?? 0}
      />
      <StatsCard
       label="Total Exposure"
       value={`$${(stats?.totalExposure ?? 0).toLocaleString()}`}
      />
     </>
    )}
   </div>

   {/* Active Listings */}
   <div className="mb-10">
    <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
     <h2 className="font-display text-lg font-semibold text-foreground">
      Active Listings
     </h2>
     <button className="font-mono text-xs uppercase tracking-wider text-primary hover:underline">
      View All Active
     </button>
    </div>

    {isLoading ? (
     <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
       <div
        key={i}
        className="h-[340px] animate-pulse border border-border bg-card"
       />
      ))}
     </div>
    ) : rooms.length === 0 ? (
     <div className="flex flex-col items-center justify-center border border-dashed border-border py-16 text-center">
      <p className="text-muted-foreground">
       {isAuctioneer
        ? "No auctions yet. Create your first auction to get started."
        : "No active auctions right now. Check back soon or join with a code."}
      </p>
      {isAuctioneer && (
       <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => router.push("/rooms/new")}>
        <Plus className="mr-2 h-4 w-4" />
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

   {/* Past Results */}
   {isAuctioneer && completedRooms.length > 0 && (
    <div>
     <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
      <h2 className="font-display text-lg font-semibold text-foreground">
       Past Results
      </h2>
      <button className="font-mono text-xs uppercase tracking-wider text-primary hover:underline">
       Export Data
      </button>
     </div>

     <div className="border border-border bg-card">
      <table className="w-full text-left text-sm">
       <thead>
        <tr className="border-b border-border text-muted-foreground">
         <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
          Lot #
         </th>
         <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
          Item
         </th>
         <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
          Date
         </th>
         <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
          Winning Bid
         </th>
         <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
          Status
         </th>
        </tr>
       </thead>
       <tbody>
        {completedRooms.slice(0, 5).map((room, index) => (
         <tr
          key={room.id}
          className="border-b border-border last:border-0"
         >
          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
           {String(index + 1).padStart(3, "0")}
          </td>
          <td className="px-4 py-3 font-medium">{room.title}</td>
          <td className="px-4 py-3 text-muted-foreground">
           {new Date(room.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
           })}
          </td>
          <td className="px-4 py-3 font-display font-bold">
           ${room.perRoomBudget.toLocaleString()}
          </td>
          <td className="px-4 py-3">
           <span className="inline-flex items-center bg-muted px-2 py-0.5 font-mono text-xs uppercase tracking-wider">
            COMPLETED
           </span>
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    </div>
   )}
  </div>
 );
}
