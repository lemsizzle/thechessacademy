"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { announceDisplayedBadge, displayedBadgeLabel } from "@/lib/badges/displayedBadge";
import { useDisplayedBadge } from "@/lib/badges/useDisplayedBadge";
import type { DisplayedBadge } from "@/lib/types";

export function FeatureBadgeButton({ studentId, badgeId, displayedBadge }: {
  studentId: string;
  badgeId: string;
  displayedBadge?: DisplayedBadge | null;
}) {
  const current = useDisplayedBadge(displayedBadge, studentId);
  const featured = current?.id === badgeId;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  async function save() {
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/student/displayed-badge", {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeId: featured ? null : badgeId })
      });
      const body = await response.json() as { displayedBadge?: DisplayedBadge | null; error?: string };
      if (!response.ok || body.displayedBadge === undefined) throw new Error(body.error || "Your badge could not be saved. Try again.");
      announceDisplayedBadge(studentId, body.displayedBadge);
      setMessage(body.displayedBadge ? `${displayedBadgeLabel(body.displayedBadge)} is now featured beside your name.` : "Your featured badge has been removed.");
      // Keep newly opened trophy cases and lower-tier dialogs in sync with the saved choice.
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Your badge could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mt-5 rounded-xl border border-amber-200/25 bg-amber-300/[0.06] p-4 text-center">
    <p className="mb-3 text-sm text-slate-300">{featured ? "This badge is featured beside your name." : "Show this badge beside your name on your profile, leaderboard, and game boards."}</p>
    <Button type="button" variant={featured ? "secondary" : "primary"} disabled={saving} onClick={() => void save()}>
      {saving ? "Saving…" : featured ? "Unfeature badge" : "Feature badge"}
    </Button>
    {message && <p role={failed ? "alert" : "status"} className={`mt-3 text-sm ${failed ? "text-rose-200" : "text-emerald-200"}`}>{message}</p>}
  </div>;
}
