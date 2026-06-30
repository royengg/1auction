"use client";

import { Loader2 } from "lucide-react";
import { TopNavigation } from "@/components/layout/top-navigation";
import { useRole } from "@/hooks/use-role";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { role, loading } = useRole();

  if (loading || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNavigation role={role} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}