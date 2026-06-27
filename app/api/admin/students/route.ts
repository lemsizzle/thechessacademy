import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { listSupabaseStudents } from "@/lib/students/supabaseStudentProfiles";
import { isSupabaseProjectConfigured } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const authenticated = await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!authenticated) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  if (!isSupabaseProjectConfigured()) {
    return NextResponse.json({ configured: false, students: [] });
  }

  const result = await listSupabaseStudents();
  if (result.error) return NextResponse.json({ configured: result.configured, students: result.students, error: result.error }, { status: 500 });
  return NextResponse.json({ configured: result.configured, students: result.students });
}
