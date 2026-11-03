import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  isValidAdminSession,
  isValidAdminActionToken,
} from "@/lib/auth/adminSession";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function authorized(request: Request) {
  return (
    (await isValidAdminSession(
      (await cookies()).get(ADMIN_SESSION_COOKIE)?.value,
    )) ||
    (await isValidAdminActionToken(request.headers.get("x-admin-action-token")))
  );
}
export async function GET(request: Request) {
  if (!(await authorized(request)))
    return json({ error: "Teacher login required." }, 401);
  const db = getSupabaseServiceClient();
  if (!db) return json({ error: "Store unavailable." }, 503);
  const pending =
    new URL(request.url).searchParams.get("status") !== "resolved";
  let query = db
    .from("store_reward_receipts")
    .select(
      "id,student_id,kind,price_paid,status,created_at,resolved_at,students(display_name)",
    )
    .eq("prize_kind", "free_class");
  query = pending
    ? query.eq("status", "pending")
    : query.in("status", ["fulfilled", "refunded"]);
  const { data, error } = await query
    .order("created_at", { ascending: pending })
    .limit(100);
  return error
    ? json({ error: "Could not load class rewards." }, 503)
    : json({ receipts: data });
}
export async function PATCH(request: Request) {
  if (!(await authorized(request)))
    return json({ error: "Teacher login required." }, 401);
  const body = await request.json().catch(() => null);
  if (
    typeof body?.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.id) ||
    !["fulfilled", "refunded"].includes(body?.status)
  )
    return json({ error: "Choose a class reward and status." }, 400);
  const db = getSupabaseServiceClient();
  if (!db) return json({ error: "Store unavailable." }, 503);
  const { data, error } = await db.rpc("resolve_free_class_reward", {
    p_receipt_id: body.id,
    p_resolution: body.status,
  });
  return error
    ? json(
        {
          error:
            error.code === "P0001"
              ? error.message
              : "Could not update the class reward.",
        },
        400,
      )
    : json({ receipt: data });
}
