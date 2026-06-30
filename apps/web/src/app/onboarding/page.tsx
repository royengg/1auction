"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Radio, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Role } from "@auction/shared";

const roles: { id: Role; title: string; description: string; icon: typeof Radio }[] = [
 {
  id: "BIDDER",
  title: "Bidder",
  description:
   "Access live auctions, place bids with precision, and track your active lots in real-time. Designed for speed and clarity.",
  icon: Radio,
 },
 {
  id: "AUCTIONEER",
  title: "Auctioneer",
  description:
   "Manage inventory, initiate live sessions, and monitor incoming bids. A command center for high-stakes trading floors.",
  icon: Store,
 },
];

export default function OnboardingPage() {
 const router = useRouter();
 const { data: session, isPending } = useSession();
 const [selectedRole, setSelectedRole] = useState<Role | null>(null);
 const [submitting, setSubmitting] = useState(false);

 useEffect(() => {
  if (!isPending && session === null) {
   router.replace("/sign-in");
  }
 }, [isPending, session, router]);

 async function handleContinue() {
  if (!selectedRole) return;
  setSubmitting(true);
  try {
   await apiClient.switchRole(selectedRole);
   router.push("/dashboard");
   router.refresh();
  } catch {
   setSubmitting(false);
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
  <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-4 py-16">
   {/* Logo */}
   <div className="text-center">
    <h1 className="font-display text-4xl font-bold text-primary">1auction</h1>
    <p className="mt-2 text-sm text-muted-foreground">
     Select your operating mode.
    </p>
   </div>

   {/* Role cards */}
   <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
    {roles.map((role) => {
     const Icon = role.icon;
     const isSelected = selectedRole === role.id;
     return (
      <button
       key={role.id}
       onClick={() => setSelectedRole(role.id)}
       className={cn(
        "flex flex-col items-start gap-4 border bg-card p-8 text-left transition-all hover:border-primary/50",
        isSelected
         ? "border-primary ring-1 ring-primary"
         : "border-border",
       )}
      >
       <Icon
        className={cn(
         "h-6 w-6",
         isSelected ? "text-primary" : "text-muted-foreground",
        )}
       />
       <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
         {role.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
         {role.description}
        </p>
       </div>
      </button>
     );
    })}
   </div>

   {/* Continue button */}
   <Button
    onClick={handleContinue}
    disabled={!selectedRole || submitting}
    className="w-full max-w-xs bg-primary/80 text-primary-foreground hover:bg-primary disabled:opacity-50"
   >
    {submitting ? (
     <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Continuing…
     </>
    ) : (
     "CONTINUE"
    )}
   </Button>

   <p className="text-sm text-muted-foreground">
    Want to sign out and use a different account?{" "}
    <Link
     href="/sign-in"
     className="font-medium text-primary underline-offset-4 hover:underline"
    >
     Switch account
    </Link>
   </p>
  </main>
 );
}
