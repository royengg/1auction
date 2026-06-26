import { Construction } from "lucide-react";

export default function MyAuctionsPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <Construction className="mb-4 h-10 w-10 text-muted-foreground" />
      <h1 className="font-display text-xl font-bold text-foreground">My Auctions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This page is coming soon. Manage auctions you&apos;ve created here.
      </p>
    </div>
  );
}