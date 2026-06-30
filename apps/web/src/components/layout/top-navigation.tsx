"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Search } from "lucide-react";

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
import { useSession, signOut } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import type { Role } from "@auction/shared";

const topNavTabs = [
  { label: "Live", href: "/dashboard?filter=live" },
  { label: "Upcoming", href: "/dashboard?filter=upcoming" },
  { label: "Results", href: "/dashboard?filter=results" },
  { label: "Dashboard", href: "/dashboard" },
] as const;

interface TopNavigationProps {
  role: Role;
}

export function TopNavigation({ role }: TopNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
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
      await queryClient.invalidateQueries({ queryKey: ["role"] });
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
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 lg:px-10">
      {/* Logo */}
      <div className="flex items-center gap-8">
        <button
          onClick={() => router.push("/dashboard")}
          className="font-display text-xl font-bold tracking-tight text-primary"
        >
          1auction
        </button>

        {/* Top nav tabs */}
        <nav className="hidden md:flex">
          <ul className="flex items-center gap-1">
            {topNavTabs.map((tab) => {
              const isActive =
                tab.href === "/dashboard"
                  ? pathname === "/dashboard" || pathname === "/"
                  : pathname === tab.href;
              return (
                <li key={tab.label}>
                  <button
                    onClick={() => router.push(tab.href)}
                    className={cn(
                      "relative px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden items-center gap-2 border border-border px-3 py-1.5 sm:flex">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="w-32 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground lg:w-48"
          />
        </div>

        {/* Role toggle */}
        <button
          onClick={handleRoleSwitch}
          disabled={isInRoom || switching}
          className={cn(
            "flex items-center overflow-hidden border border-border text-xs font-medium tracking-[0.2em] uppercase",
            isInRoom && "cursor-not-allowed opacity-50",
          )}
        >
          <span
            className={cn(
              "px-4 py-2",
              role === "AUCTIONEER"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground",
            )}
          >
            AUCTIONEER
          </span>
          <span
            className={cn(
              "px-4 py-2",
              role === "BIDDER"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground",
            )}
          >
            BIDDER
          </span>
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 bg-primary" />
        </button>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 transition-colors hover:bg-muted">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-muted text-xs text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
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
