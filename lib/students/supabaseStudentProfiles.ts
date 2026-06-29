import { getSupabaseServerReadClient, getSupabaseServiceClient, isSupabaseProjectConfigured, isSupabaseServiceConfigured } from "@/lib/supabase/server";
import type { Student, StudentSession } from "@/lib/types";

type SupabaseStudentRow = {
  id: string;
  display_name: string;
  public_slug: string;
  avatar_url: string | null;
  class_group: string | null;
  total_xp: number | null;
  is_active: boolean | null;
  lichess_id?: string | null;
  lichess_username?: string | null;
};

export type StudentProfileLookup = {
  configured: boolean;
  student: Student | null;
  error?: string;
};

export function slugifyStudent(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `student-${Date.now()}`;
}

function toStudent(row: SupabaseStudentRow): Student {
  return {
    id: row.id,
    slug: row.public_slug,
    lichessUsername: row.lichess_username ?? row.public_slug,
    name: row.display_name,
    avatar: row.avatar_url ?? row.display_name.slice(0, 1).toUpperCase(),
    classGroup: row.class_group ?? "Unassigned",
    source: "manual",
    isActive: row.is_active ?? true,
    onboardingCompleted: true,
    totalXp: row.total_xp ?? 0,
    badgeIds: [],
    completedQuestIds: [],
    encouragement: "Welcome to the academy. Your Lichess account is linked and your quest board is ready."
  };
}

const studentSelect = "id,display_name,public_slug,avatar_url,class_group,total_xp,is_active,lichess_id,lichess_username";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isSupabaseStudentId(value: string) {
  return isUuid(value);
}

export async function findSupabaseStudentById(studentId: string): Promise<StudentProfileLookup> {
  const supabase = getSupabaseServerReadClient() ?? getSupabaseServiceClient();
  if (!supabase) {
    return isSupabaseProjectConfigured()
      ? { configured: true, student: null, error: "Supabase URL is set, but no Supabase read or service key is configured." }
      : { configured: false, student: null };
  }
  if (!isUuid(studentId)) return { configured: true, student: null };

  const { data, error } = await supabase
    .from("students")
    .select(studentSelect)
    .eq("id", studentId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { configured: true, student: null, error: error.message };
  return { configured: true, student: data ? toStudent(data as SupabaseStudentRow) : null };
}

export async function listSupabaseStudents(): Promise<StudentProfileLookup & { students: Student[] }> {
  const supabase = getSupabaseServerReadClient() ?? getSupabaseServiceClient();
  if (!supabase) {
    return isSupabaseProjectConfigured()
      ? { configured: true, student: null, students: [], error: "Supabase URL is set, but no Supabase read or service key is configured." }
      : { configured: false, student: null, students: [] };
  }

  const { data, error } = await supabase
    .from("students")
    .select(studentSelect)
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) return { configured: true, student: null, students: [], error: error.message };
  return { configured: true, student: null, students: ((data ?? []) as SupabaseStudentRow[]).map(toStudent) };
}

export async function findSupabaseStudentByLichess(lichessId: string, lichessUsername: string): Promise<StudentProfileLookup> {
  const supabase = getSupabaseServerReadClient() ?? getSupabaseServiceClient();
  if (!supabase) {
    return isSupabaseProjectConfigured()
      ? { configured: true, student: null, error: "Supabase URL is set, but no Supabase read or service key is configured." }
      : { configured: false, student: null };
  }

  const cleanId = lichessId.trim();
  const cleanUsername = lichessUsername.trim();

  if (cleanId) {
    const byId = await supabase
      .from("students")
      .select(studentSelect)
      .eq("lichess_id", cleanId)
      .eq("is_active", true)
      .maybeSingle();

    if (byId.error) return { configured: true, student: null, error: byId.error.message };
    if (byId.data) return { configured: true, student: toStudent(byId.data as SupabaseStudentRow) };
  }

  if (cleanUsername) {
    const byUsername = await supabase
      .from("students")
      .select(studentSelect)
      .ilike("lichess_username", cleanUsername)
      .eq("is_active", true)
      .maybeSingle();

    if (byUsername.error) return { configured: true, student: null, error: byUsername.error.message };
    if (byUsername.data) return { configured: true, student: toStudent(byUsername.data as SupabaseStudentRow) };
  }

  return { configured: true, student: null };
}

async function createUniqueSlug(baseValue: string) {
  const supabase = getSupabaseServerReadClient() ?? getSupabaseServiceClient();
  if (!supabase) return slugifyStudent(baseValue);

  const base = slugifyStudent(baseValue);
  for (let index = 0; index < 20; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const { data, error } = await supabase
      .from("students")
      .select("id")
      .eq("public_slug", slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return slug;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createSupabaseStudentForLichess(
  session: StudentSession,
  input: { displayName: string; classGroup: string }
) {
  if (!isSupabaseServiceConfigured()) {
    throw new Error("Supabase service role is not configured.");
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const existing = await findSupabaseStudentByLichess(session.lichessUserId, session.lichessUsername);
  if (existing.student) return existing.student;
  if (existing.error) throw new Error(existing.error);

  const displayName = input.displayName.trim();
  const classGroup = input.classGroup.trim() || "Unassigned";
  const publicSlug = await createUniqueSlug(session.lichessUsername || displayName);

  const { data, error } = await supabase
    .from("students")
    .insert({
      display_name: displayName,
      public_slug: publicSlug,
      avatar_url: null,
      class_group: classGroup,
      total_xp: 0,
      level: 1,
      is_active: true,
      lichess_id: session.lichessUserId,
      lichess_username: session.lichessUsername
    })
    .select(studentSelect)
    .single();

  if (error) throw new Error(error.message);
  return toStudent(data as SupabaseStudentRow);
}

async function findSupabaseStudentIds(identifier: string, slug?: string, lichessUsername?: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  if (isSupabaseStudentId(identifier)) return [identifier];

  const candidates = Array.from(new Set([identifier, slug, lichessUsername].map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
  const ids = new Set<string>();

  for (const candidate of candidates) {
    const [bySlug, byUsername] = await Promise.all([
      supabase.from("students").select("id").eq("public_slug", candidate),
      supabase.from("students").select("id").ilike("lichess_username", candidate)
    ]);

    if (bySlug.error) throw new Error(bySlug.error.message);
    if (byUsername.error) throw new Error(byUsername.error.message);
    for (const row of (bySlug.data ?? []) as Array<{ id: string }>) ids.add(row.id);
    for (const row of (byUsername.data ?? []) as Array<{ id: string }>) ids.add(row.id);
  }

  return [...ids];
}

export async function deleteSupabaseStudentById(studentId: string, options: { slug?: string; lichessUsername?: string } = {}) {
  if (!isSupabaseServiceConfigured()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to delete students from Supabase.");
  }

  const ids = await findSupabaseStudentIds(studentId, options.slug, options.lichessUsername);
  if (!ids.length) {
    return { deleted: false, skipped: true };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const { error } = await supabase
    .from("students")
    .delete()
    .in("id", ids);

  if (error) throw new Error(error.message);
  return { deleted: true, skipped: false, count: ids.length };
}

export async function addSupabaseStudentXp(
  studentId: string,
  input: { amount: number; reason: string; slug?: string; lichessUsername?: string }
) {
  if (!isSupabaseServiceConfigured()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to update student XP in Supabase.");
  }

  const ids = await findSupabaseStudentIds(studentId, input.slug, input.lichessUsername);
  if (!ids.length) return { updated: false, skipped: true };

  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const studentIdToUpdate = ids[0];
  const { data: current, error: currentError } = await supabase
    .from("students")
    .select("id,total_xp")
    .eq("id", studentIdToUpdate)
    .single();

  if (currentError) throw new Error(currentError.message);

  const currentXp = Number((current as { total_xp?: number | null }).total_xp ?? 0);
  const nextXp = Math.max(0, currentXp + input.amount);

  const { data: updated, error: updateError } = await supabase
    .from("students")
    .update({ total_xp: nextXp })
    .eq("id", studentIdToUpdate)
    .select(studentSelect)
    .single();

  if (updateError) throw new Error(updateError.message);

  const { data: event, error: eventError } = await supabase
    .from("xp_events")
    .insert({
      student_id: studentIdToUpdate,
      amount: input.amount,
      reason: input.reason
    })
    .select("id,student_id,amount,reason,created_at")
    .single();

  if (eventError) throw new Error(eventError.message);

  return {
    updated: true,
    skipped: false,
    student: toStudent(updated as SupabaseStudentRow),
    event: {
      id: (event as { id: string }).id,
      studentId: (event as { student_id: string }).student_id,
      amount: (event as { amount: number }).amount,
      reason: (event as { reason: string }).reason,
      createdAt: (event as { created_at: string }).created_at
    }
  };
}
