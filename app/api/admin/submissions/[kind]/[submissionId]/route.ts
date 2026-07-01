import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { reviewGameSubmission } from "@/lib/submissions/reviewGameSubmission";
import { reviewScoreSubmission } from "@/lib/submissions/reviewScoreSubmission";
import { updateSupabaseGameSubmission, updateSupabaseScoreSubmission } from "@/lib/submissions/supabaseSubmissions";
import type { StudentGameSubmission, StudentScoreSubmission, SubmissionReviewAction } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ kind: string; submissionId: string }>;
};

async function requireAdmin(request: Request) {
  const cookieStore = await cookies();
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(request.headers.get("x-admin-action-token"));
}

function cleanAction(value: unknown): SubmissionReviewAction {
  if (value === "reject") return "reject";
  if (value === "needs_changes") return "needs_changes";
  return "approve";
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  const { kind } = await params;
  const body = await request.json().catch(() => ({})) as {
    action?: SubmissionReviewAction;
    teacherNote?: string;
    submission?: StudentGameSubmission | StudentScoreSubmission;
    xpAwarded?: number;
    tacticProgressAdded?: number;
  };
  if (!body.submission) return NextResponse.json({ error: "Submission is required." }, { status: 400 });

  try {
    if (kind === "scores") {
      const reviewed = reviewScoreSubmission(
        body.submission as StudentScoreSubmission,
        cleanAction(body.action),
        body.teacherNote,
        Math.max(0, Number(body.xpAwarded ?? 0)),
        Math.max(0, Number(body.tacticProgressAdded ?? 0))
      );
      const result = await updateSupabaseScoreSubmission(reviewed);
      return NextResponse.json({ ok: true, type: "score", ...result });
    }

    const reviewed = reviewGameSubmission(
      body.submission as StudentGameSubmission,
      cleanAction(body.action),
      body.teacherNote
    );
    const result = await updateSupabaseGameSubmission(reviewed);
    return NextResponse.json({ ok: true, type: "game", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update submission.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
