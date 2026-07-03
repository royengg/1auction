"use client";

import { useEffect, useState } from "react";

export function useAuctionTimer(endsAt: number | null, paused: boolean) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!endsAt || paused) {
      if (paused && endsAt) {
        setRemainingMs(Math.max(0, endsAt - Date.now()));
      } else if (!endsAt) {
        setRemainingMs(0);
      }
      return;
    }

    setRemainingMs(Math.max(0, endsAt - Date.now()));

    const interval = setInterval(() => {
      const rem = endsAt - Date.now();
      setRemainingMs(Math.max(0, rem));
      if (rem <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [endsAt, paused]);

  const seconds = Math.ceil(remainingMs / 1000);
  const isExpired = remainingMs <= 0 && endsAt !== null && !paused;

  return { remainingMs, seconds, isExpired };
}