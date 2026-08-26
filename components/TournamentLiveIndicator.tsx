"use client";

import { useCallback, useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 30_000;

export function TournamentLiveIndicator() {
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/tournaments/live-status", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { live?: boolean };
      setLive(data.live === true);
    } catch {
      // Navigation remains usable when live status cannot be refreshed.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  if (!live) return null;

  return (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-red-300/30 bg-red-400/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-200" aria-label="Tournament live now">
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-red-400" />
      </span>
      Live
    </span>
  );
}
