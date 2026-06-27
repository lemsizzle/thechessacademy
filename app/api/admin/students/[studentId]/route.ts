import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { deleteSupabaseStudentById } from "@/lib/students/supabaseStudentProfiles";
import { isSupabaseProjectConfigured, isSupabaseServiceConfigured } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ studentId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const cookieStore = await cookies();
  const authenticated = await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
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
    const result = await deleteSupabaseStudentById(studentId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete student from Supabase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
