"use client";

import { useEffect, useState } from "react";
import type { ReviewAssignment } from "@/chess/analysis/types";
import { ReviewAssignmentCards } from "@/chess/components/ReviewAssignmentCards";

export function StudyReviewAssignments({ studyId }: { studyId: string }) {
  const [assignments, setAssignments] = useState<ReviewAssignment[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chess/review-assignments?studyId=${encodeURIComponent(studyId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { assignments?: ReviewAssignment[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Assigned review could not be loaded.");
        if (!cancelled) setAssignments(body.assignments ?? []);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Assigned review could not be loaded."); });
    return () => { cancelled = true; };
  }, [studyId]);

  if (error) return <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100" role="alert">{error}</p>;
  if (!assignments?.length) return null;
  return <section aria-labelledby="study-review-heading">
    <div className="mb-3"><p className="text-xs font-black uppercase text-amber-200">Teacher review</p><h2 id="study-review-heading" className="text-xl font-black text-white">Your assignment</h2></div>
    <ReviewAssignmentCards initialAssignments={assignments} basePath="/student" />
  </section>;
}
