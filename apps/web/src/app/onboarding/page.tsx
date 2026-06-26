"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Gavel, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import type { Role } from "@auction/shared";

const roles: { id: Role; title: string; description: string; icon: typeof Gavel }[] = [
  {
    id: "AUCTIONEER",
    title: "I'm an Auctioneer",
    description: "Create a room, list items, invite bidders, and run the auction live.",
    icon: Gavel,
  },
  {
    id: "BIDDER",
    title: "I'm a Bidder",
    description: "Browse public auctions, join with a room code, and bid live.",
    icon: Eye,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && session === null) {
      router.replace("/sign-in");
    }
  }, [isPending, session, router]);

  async function pickRole(role: Role) {
    setSubmitting(role);
    try {
      await apiClient.switchRole(role);
      router.push("/dashboard");
      router.refresh();
    } catch {
      setSubmitting(null);
    }
  }

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Welcome, {session.user.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a profile to continue. You can switch roles later from the dashboard.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <Card key={role.id} className="flex flex-col border-border bg-card">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-display">{role.title}</CardTitle>
                <CardDescription>{role.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-4">
                <Button
                  onClick={() => pickRole(role.id)}
                  disabled={submitting !== null}
                  className="w-full"
                >
                  {submitting === role.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Continuing…
                    </>
                  ) : (
                    "Continue as " + role.id.toLowerCase()
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Want to sign out and use a different account?{" "}
        <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
          Switch account
        </Link>
      </p>
    </main>
  );
}