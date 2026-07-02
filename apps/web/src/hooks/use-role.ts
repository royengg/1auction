"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import type { Role } from "@auction/shared";

interface RoleState {
  role: Role | null;
  loading: boolean;
}

export function useRole(): RoleState {
  const { data: session, isPending } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["role"],
    queryFn: () => apiClient.getRole(),
    enabled: !!session && !isPending,
  });

  return { role: data?.activeRole ?? null, loading: isLoading || isPending };
}