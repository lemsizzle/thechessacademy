import type { SubmissionStatus } from "@/lib/types";

export function getSubmissionStatusStyles(status: SubmissionStatus) {
  const styles: Record<SubmissionStatus, string> = {
    pending: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    approved: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    rejected: "border-rose-300/30 bg-rose-300/10 text-rose-100",
    needs_changes: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
  };
  return styles[status];
}
