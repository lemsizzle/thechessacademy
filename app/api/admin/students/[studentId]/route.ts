import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { addSupabaseStudentXp, deleteSupabaseStudentById } from "@/lib/students/supabaseStudentProfiles";
import { isSupabaseProjectConfigured, isSupabaseServiceConfigured } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ studentId: string }>;
};

async function requireAdmin(request: Request) {
  const cookieStore = await cookies();
  const actionToken = request.headers.get("x-admin-action-token");
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(actionToken);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authenticated = await requireAdmin(_request);
  if (!authenticated) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  const { studentId } = await params;
  if (!studentId) return NextResponse.json({ error: "Missing student id." }, { status: 400 });

  if (!isSupabaseProjectConfigured()) {
    return NextResponse.json({ ok: true, deleted: false, mode: "local-only" });
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required to delete students from Supabase." }, { status: 500 });
  }

  try {
    const requestUrl = new URL(_request.url);
    const result = await deleteSupabaseStudentById(studentId, {
      slug: requestUrl.searchParams.get("slug") ?? undefined,
      lichessUsername: requestUrl.searchParams.get("lichessUsername") ?? undefined
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete student from Supabase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authenticated = await requireAdmin(request);
  if (!authenticated) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  const { studentId } = await params;
  if (!studentId) return NextResponse.json({ error: "Missing student id." }, { status: 400 });

  const body = await request.json().catch(() => ({})) as {
    xpAmount?: number;
    reason?: string;
    slug?: string;
    lichessUsername?: string;
  };
  const xpAmount = Number(body.xpAmount ?? 0);
  const reason = body.reason?.trim() || "Teacher XP adjustment";
  if (!Number.isFinite(xpAmount) || xpAmount === 0) {
    return NextResponse.json({ error: "XP amount must be a non-zero number." }, { status: 400 });
  }

  if (!isSupabaseProjectConfigured()) {
    return NextResponse.json({ ok: true, updated: false, mode: "local-only" });
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required to save XP to Supabase." }, { status: 500 });
  }

  try {
    const result = await addSupabaseStudentXp(studentId, {
      amount: xpAmount,
      reason,
      slug: body.slug,
      lichessUsername: body.lichessUsername
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save XP to Supabase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
