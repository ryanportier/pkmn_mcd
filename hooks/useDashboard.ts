"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DashboardData } from "@/types";

const POLL_MS = 5000;

const EMPTY: DashboardData = {
  vault: null,
  holders: [],
  recent_payouts: [],
  token_price_usd: 0,
  token_price_change_24h: 0,
  market_cap_usd: 0,
  volume_24h_usd: 0,
  magic_phrase: "gotta catch em all",
  shifts_completed: 0,
};

export function useDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("fetch error");
      const json: DashboardData = await res.json();
      setData(json);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  return { data, loading, offline };
}
