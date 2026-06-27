import { getSubmissionStatusStyles } from "@/lib/submissions/submissionStatus";
import type { SubmissionStatus } from "@/lib/types";

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span className={`inline-flex w-fit rounded border px-2 py-1 text-[11px] font-black uppercase ${getSubmissionStatusStyles(status)}`}>
      {status.replace("_", " ")}
    </span>
  );
}
