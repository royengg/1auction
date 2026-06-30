"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gavel,
  LayoutDashboard,
  Gavel as ActiveBids,
  Hammer,
  Eye,
  Settings,
  HelpCircle,
  LogOut,
  Lock,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useSession, signOut } from "@/lib/auth-client";
import type { Role } from "@auction/shared";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Active Bids", href: "/active-bids", icon: ActiveBids },
  { label: "My Auctions", href: "/my-auctions", icon: Hammer },
  { label: "Watchlist", href: "/watchlist", icon: Eye },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface AppSidebarProps {
  role: Role;
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userName = session?.user?.name ?? "User";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isAuctioneer = role === "AUCTIONEER";

  async function handleSignOut() {
    await signOut();
    window.location.href = "/sign-in";
  }

  return (
    <aside className="flex h-full w-[260px] flex-col border-r border-border bg-card">
      {/* User info */}
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarFallback className="bg-muted text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {userName}
          </p>
          <p className="text-xs text-muted-foreground">
            {isAuctioneer ? "Auctioneer Mode" : "Premium Bidder"}
          </p>
        </div>
      </div>

      {/* Create Auction button */}
      <div className="p-4">
        {isAuctioneer ? (
          <Button asChild className="w-full">
            <Link href="/rooms/new">
              <Gavel className="mr-2 h-4 w-4" />
              Create Auction
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full cursor-not-allowed opacity-60"
            title="Switch to Auctioneer mode to create auctions"
          >
            <Lock className="mr-2 h-4 w-4" />
            Create Auction
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3  px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-4">
        <ul className="space-y-1">
          <li>
            <Link
              href="#"
              className="flex items-center gap-3  px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
              Help Center
            </Link>
          </li>
          <li>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3  px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}