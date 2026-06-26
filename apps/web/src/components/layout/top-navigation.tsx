"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession, signOut } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import type { Role } from "@auction/shared";

const topNavTabs = ["Live Auctions", "Upcoming", "Results", "Categories"] as const;

interface TopNavigationProps {
  role: Role;
}

export function TopNavigation({ role }: TopNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [switching, setSwitching] = useState(false);

  const userName = session?.user?.name ?? "User";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isInRoom = pathname.startsWith("/rooms/");
  const newRole: Role = role === "AUCTIONEER" ? "BIDDER" : "AUCTIONEER";

  async function handleRoleSwitch() {
    setSwitching(true);
    try {
      await apiClient.switchRole(newRole);
      router.refresh();
    } catch {
      // error handled by axios interceptor
    } finally {
      setSwitching(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = "/sign-in";
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      {/* Logo */}
      <div className="flex items-center gap-8">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
          1auction
        </h1>

        {/* Top nav tabs */}
        <nav className="hidden md:flex">
          <ul className="flex items-center gap-1">
            {topNavTabs.map((tab) => (
              <li key={tab}>
                <button className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  {tab}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Role toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleRoleSwitch}
                disabled={isInRoom || switching}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors",
                  isInRoom
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-semibold",
                    role === "AUCTIONEER"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-blue-500/10 text-blue-400",
                  )}
                >
                  {role === "AUCTIONEER" ? "Auctioneer" : "Bidder"}
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="text-xs text-muted-foreground">
                  {newRole === "AUCTIONEER" ? "Auctioneer" : "Bidder"}
                </span>
              </button>
            </TooltipTrigger>
            {isInRoom && (
              <TooltipContent>
                Role switching is locked during an active auction
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Notifications */}
        <button className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-accent">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-muted text-xs text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{userName}</span>
                <span className="text-xs text-muted-foreground">
                  {session?.user?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button
                onClick={handleRoleSwitch}
                disabled={isInRoom || switching}
                className="w-full cursor-pointer"
              >
                Switch to {newRole.toLowerCase()}
              </button>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button onClick={handleSignOut} className="w-full cursor-pointer">
                Sign out
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}