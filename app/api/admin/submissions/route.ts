import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { listSupabaseSubmissions } from "@/lib/submissions/supabaseSubmissions";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const cookieStore = await cookies();
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(request.headers.get("x-admin-action-token"));
}

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  const result = await listSupabaseSubmissions();
  if (result.error) return NextResponse.json({ ...result, mode: "local-only" });
  return NextResponse.json(result);
}
