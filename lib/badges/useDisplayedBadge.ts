"use client";

import { useEffect, useState } from "react";
import { DISPLAYED_BADGE_CHANGED } from "./displayedBadge";
import type { DisplayedBadge } from "@/lib/types";

export function useDisplayedBadge(badge?: DisplayedBadge | null, studentId?: string) {
  const [current, setCurrent] = useState(badge ?? null);
  useEffect(() => setCurrent(badge ?? null), [badge]);
  useEffect(() => {
    if (!studentId) return;
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ studentId: string; badge: DisplayedBadge | null }>).detail;
      if (detail?.studentId === studentId) setCurrent(detail.badge);
    };
    window.addEventListener(DISPLAYED_BADGE_CHANGED, update);
    return () => window.removeEventListener(DISPLAYED_BADGE_CHANGED, update);
  }, [studentId]);
  return current;
}
