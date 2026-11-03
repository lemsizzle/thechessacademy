import { NextResponse } from "next/server";
import {
  requireActiveStudent,
  StudentAuthenticationError,
} from "@/lib/auth/requireActiveStudent";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getStudentAvatarState } from "@/lib/avatar/supabaseAvatar";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  try {
    const user = await requireActiveStudent(),
      db = getSupabaseServiceClient();
    if (!db)
      return json({ error: "Store rewards are temporarily unavailable." }, 503);
    const [recent, pending] = await Promise.all([
      db
        .from("store_reward_receipts")
        .select("*")
        .eq("student_id", user.studentId)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("store_reward_receipts")
        .select("*", { count: "exact" })
        .eq("student_id", user.studentId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (recent.error || pending.error)
      return json({ error: "Store rewards are temporarily unavailable." }, 503);
    return json({
      availableCouponCount: pending.count ?? pending.data.length,
      receipts: [
        ...new Map(
          [...pending.data, ...recent.data].map((r) => [r.id, r]),
        ).values(),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    });
  } catch (e) {
    return json(
      {
        error:
          e instanceof StudentAuthenticationError
            ? "Please log in to visit the store."
            : "Store rewards couldn't load.",
      },
      e instanceof StudentAuthenticationError ? 401 : 503,
    );
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireActiveStudent();
    const body = await request.json().catch(() => null);
    if (
      !["mystery_box", "free_class"].includes(body?.kind) ||
      typeof body?.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.requestId,
      )
    )
      return json({ error: "Choose a store reward." }, 400);
    const db = getSupabaseServiceClient();
    if (!db)
      return json({ error: "Store rewards are temporarily unavailable." }, 503);
    const before = await getStudentAvatarState(user.studentId);
    if (!before.configured || before.source !== "supabase")
      return json({ error: "Your wallet couldn't load. Please retry." }, 503);
    const { data: receipt, error } = await db.rpc("purchase_store_reward", {
      p_student_id: user.studentId,
      p_kind: body.kind,
      p_request_id: body.requestId,
    });
    if (error)
      return json(
        {
          error:
            error.code === "P0001"
              ? error.message
              : "The purchase couldn't be confirmed. Retry to recover it safely.",
        },
        error.code === "P0001" ? 400 : 503,
      );
    const state = await getStudentAvatarState(user.studentId);
    return json({ receipt, state: state.configured && state.source === "supabase" ? state : null });
  } catch (e) {
    return json(
      {
        error:
          e instanceof StudentAuthenticationError
            ? "Please log in to visit the store."
            : "The purchase couldn't be confirmed. Retry to recover it safely.",
      },
      e instanceof StudentAuthenticationError ? 401 : 503,
    );
  }
}
