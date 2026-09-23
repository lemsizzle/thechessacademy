import { UNASSIGNED_CLASS } from "@/lib/classes";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { mergeRosterClasses } from "@/lib/classSettings";
import type { ClassGroup } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET() {
  const db = getSupabaseServiceClient();
  if (!db) return NextResponse.json({ error: "Class settings unavailable." }, { status: 503 });
  const [settings, roster] = await Promise.all([
    db.from("academy_class_settings").select("groups,revision").eq("singleton", true).single(),
    db.from("students").select("class_group").eq("is_active", true).not("class_group", "is", null)
  ]);
  if (settings.error || roster.error) return NextResponse.json({ error: "Class settings unavailable." }, { status: 503 });
  const groups = mergeRosterClasses(settings.data.groups as ClassGroup[], (roster.data ?? []).map(row => row.class_group ?? ""));
  const data = [{ id: "unassigned", name: UNASSIGNED_CLASS, outschoolClassUrl: "", syncStatus: "not-connected" }, ...groups.sort((a,b) => a.name.localeCompare(b.name)).map(group => ({ id: group.id, name: group.name, outschoolClassUrl: group.outschoolClassUrl, syncStatus: group.syncStatus }))];
  return NextResponse.json({ data, names: data.map(group => group.name) }, { headers: { "Cache-Control": "no-store" } });
}
