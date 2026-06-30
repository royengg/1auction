import Link from "next/link";
import { Zap, Users, ShieldCheck } from "lucide-react";

export default function HomePage() {
 return (
  <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
   <h1 className="font-display text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
    1auction
   </h1>
   <p className="mt-4 max-w-prose text-muted-foreground">
    A realtime auction platform. Create a room, list your items, invite up
    to six bidders, and let the room bid live.
   </p>

   <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
    <Link
     href="/sign-in"
     className="inline-flex h-11 items-center justify-center bg-primary px-8 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
    >
     Sign in
    </Link>
    <Link
     href="/sign-up"
     className="inline-flex h-11 items-center justify-center border border-border bg-background px-8 text-sm font-semibold text-foreground transition hover:bg-accent"
    >
     Create an account
    </Link>
   </div>

   <div className="mt-16 grid max-w-3xl gap-6 sm:grid-cols-3">
    <div className="flex flex-col items-center gap-2">
     <Zap className="h-6 w-6 text-primary" />
     <h3 className="font-display text-sm font-semibold">Realtime Bidding</h3>
     <p className="text-xs text-muted-foreground">Live bids sync instantly</p>
    </div>
    <div className="flex flex-col items-center gap-2">
     <Users className="h-6 w-6 text-primary" />
     <h3 className="font-display text-sm font-semibold">Up to 6 Bidders</h3>
     <p className="text-xs text-muted-foreground">Invite with a 4-digit code</p>
    </div>
    <div className="flex flex-col items-center gap-2">
     <ShieldCheck className="h-6 w-6 text-primary" />
     <h3 className="font-display text-sm font-semibold">Secure Auctions</h3>
     <p className="text-xs text-muted-foreground">Server-authoritative</p>
    </div>
   </div>
  </main>
 );
}