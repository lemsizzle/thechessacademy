import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { mergeRosterClasses, validateClassGroups } from "@/lib/classSettings";

export const dynamic = "force-dynamic";
async function authorized(request: Request, write = false) {
  if (write && request.headers.get("origin") !== new URL(request.url).origin) return false;
  return isValidAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
}
export async function GET(request: Request) {
  if (!await authorized(request)) return NextResponse.json({ error: "Teacher login required." }, { status: 401 });
  try {
    const { data, error } = await getSupabaseAdminClient().from("academy_class_settings").select("groups,revision").eq("singleton", true).single();
    if (error) throw error;
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load server class settings. Your local settings are unchanged." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!await authorized(request, true)) return NextResponse.json({ error: "Teacher login required." }, { status: 401 });
  try {
    const body = await request.text();
    if (body.length > 600_000) throw new Error("Class settings are too large.");
    const input = JSON.parse(body);
    const groups = validateClassGroups(input.groups);
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error("Invalid class revision.");
    const db = getSupabaseAdminClient();
    let next = groups;
    if (input.import === true) {
      const roster = await db.from("students").select("class_group");
      if (roster.error) throw new Error("Could not load roster classes. Please retry.");
      next = validateClassGroups(mergeRosterClasses(groups, (roster.data ?? []).map(row => row.class_group ?? "")));
    }
    const { data, error } = await db.rpc("save_academy_classes", { p_groups: next, p_revision: input.revision, p_import: input.import === true, p_backup: input.import === true ? input.backup ?? input.groups : null });
    if (error) return NextResponse.json({ error: error.code === "40001" ? "Another tab changed these classes. Reload classes before saving; your draft is still here." : "Class settings could not be saved. Your draft is still here." }, { status: error.code === "40001" ? 409 : 503 });
    return NextResponse.json(data);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid class settings." }, { status: 400 }); }
}
