"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import type { Role } from "@auction/shared";

interface RoleState {
  role: Role | null;
  loading: boolean;
}

export function useRole(): RoleState {
  const { data: session, isPending } = useSession();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      setRole(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    apiClient
      .getRole()
      .then((res) => {
        if (!cancelled) setRole(res.activeRole);
      })
      .catch(() => {
        if (!cancelled) setRole(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, isPending]);

  return { role, loading };
}