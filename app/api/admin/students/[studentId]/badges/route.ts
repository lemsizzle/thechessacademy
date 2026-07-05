import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { awardSupabaseStudentBadge } from "@/lib/students/supabaseStudentProfiles";
import { isSupabaseProjectConfigured, isSupabaseServiceConfigured } from "@/lib/supabase/server";
import type { Badge } from "@/lib/types";
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

export async function POST(request: Request, { params }: RouteContext) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  const { studentId } = await params;
  if (!studentId) return NextResponse.json({ error: "Missing student id." }, { status: 400 });

  const body = await request.json().catch(() => ({})) as {
    badgeId?: string;
    note?: string;
    slug?: string;
    lichessUsername?: string;
    awardBadgeXp?: boolean;
    badge?: Partial<Badge>;
  };
  if (!body.badgeId) return NextResponse.json({ error: "Badge is required." }, { status: 400 });

  if (!isSupabaseProjectConfigured()) {
    return NextResponse.json({ ok: true, awarded: false, mode: "local-only" });
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required to award badges in Supabase." }, { status: 500 });
  }

  try {
    const result = await awardSupabaseStudentBadge(studentId, {
      badgeId: body.badgeId,
      note: body.note,
      slug: body.slug,
      lichessUsername: body.lichessUsername,
      awardBadgeXp: body.awardBadgeXp,
      badge: body.badge
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not award badge.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
