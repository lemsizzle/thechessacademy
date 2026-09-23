import { NextRequest, NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Celebration } from "@/lib/celebrations";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  try {
    const { studentId } = await requireActiveStudent();
    const now = Date.now();
    const requested = Date.parse(request.nextUrl.searchParams.get("since") ?? "");
    const cursor = new Date(now).toISOString();
    // Establish a baseline on first visit; don't replay a student's old awards.
    if (!Number.isFinite(requested)) return NextResponse.json({ cursor, events: [] }, { headers });
    const since = new Date(Math.min(now, Math.max(requested - 5000, now - 86_400_000))).toISOString();
    const db = getSupabaseAdminClient();
    const [badges, quests] = await Promise.all([
      db.from("student_badges").select("badge_id,awarded_at").eq("student_id", studentId).gte("awarded_at", since).lte("awarded_at", cursor).order("awarded_at", { ascending: false }).limit(30),
      db.from("quest_completion_events").select("id,quest_id,completed_at").eq("student_id", studentId).gte("completed_at", since).lte("completed_at", cursor).order("completed_at", { ascending: false }).limit(30)
    ]);
    if (badges.error || quests.error) throw new Error("Could not check rewards.");
    const badgeRows = badges.data ?? [], questRows = quests.data ?? [];
    const [names, titles] = await Promise.all([
      badgeRows.length ? db.from("badges").select("id,name").in("id", badgeRows.map(row => row.badge_id)) : Promise.resolve({ data: [], error: null }),
      questRows.length ? db.from("academy_quests").select("id,title").in("id", questRows.map(row => row.quest_id)) : Promise.resolve({ data: [], error: null })
    ]);
    if (names.error || titles.error) throw new Error("Could not read reward names.");
    const events: Celebration[] = [
      ...badgeRows.map(row => ({ id: `badge:${row.badge_id}`, kind: "badge" as const, name: names.data?.find(badge => badge.id === row.badge_id)?.name ?? "Achievement unlocked" })),
      ...questRows.map(row => ({ id: `quest:${row.id}`, kind: "quest" as const, name: titles.data?.find(quest => quest.id === row.quest_id)?.title ?? "Quest completed" }))
    ];
    return NextResponse.json({ cursor, events }, { headers });
  } catch (error) {
    return NextResponse.json({ error: "Could not check rewards." }, { status: error instanceof StudentAuthenticationError ? 401 : 500, headers });
  }
}
