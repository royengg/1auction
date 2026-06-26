"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, LogIn, ShieldCheck } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function JoinRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const router = useRouter();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: roomDetail, isLoading } = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => apiClient.getRoom(roomId),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter the room code.");
      return;
    }
    setJoining(true);
    try {
      await apiClient.joinRoom(roomId, trimmed);
      router.push(`/rooms/${roomId}/lobby`);
    } catch (err) {
      setJoining(false);
      setError(
        err instanceof Error ? err.message : "Invalid room code. Try again.",
      );
    }
  }

  if (isLoading || !roomDetail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
          1auction
        </h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </header>

      {/* Centered card */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="space-y-4 pb-6 text-center">
            <div className="flex items-center justify-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-sm font-medium text-primary">
                High-Stakes Security Guaranteed
              </p>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Join Auction
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter the access code to join{" "}
              <span className="font-semibold text-foreground">
                {roomDetail.title}
              </span>
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Room Code
                </label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 3098"
                  maxLength={4}
                  className="text-center font-mono text-2xl tracking-[0.5em] uppercase"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Ask the auctioneer for the 4-digit code
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={joining}
                className="w-full"
              >
                {joining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Join Room
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}