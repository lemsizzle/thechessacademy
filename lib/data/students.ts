import { students as mockStudents } from "@/data/students";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Student } from "@/lib/types";
import { mockResult, shouldUseMock, supabaseResult, type DataResult } from "./shared";

type StudentRow = {
  id: string;
  display_name: string;
  public_slug: string;
  avatar_url: string | null;
  class_group: string | null;
  total_xp: number | null;
  level: number | null;
  is_active: boolean | null;
};

type StudentBadgeRow = {
  student_id: string;
  badge_id: string;
};

type StudentQuestRow = {
  student_id: string;
  quest_id: string;
  status: string | null;
};

function avatarFromName(name: string) {
  return name.trim().charAt(0).toUpperCase() || "K";
}

function encouragementFor(name: string) {
  return `${name} is building a stronger chess adventure one quest at a time. Keep checking forcing moves and trust the process.`;
}

function mapStudent(row: StudentRow, badgeIds: string[], completedQuestIds: string[]): Student {
  return {
    id: row.id,
    slug: row.public_slug,
    lichessUsername: row.public_slug,
    name: row.display_name,
    avatar: row.avatar_url ?? avatarFromName(row.display_name),
    classGroup: row.class_group ?? "Unassigned",
    source: "manual",
    isActive: row.is_active ?? true,
    totalXp: row.total_xp ?? 0,
    badgeIds,
    completedQuestIds,
    encouragement: encouragementFor(row.display_name)
  };
}

async function hydrateStudents(rows: StudentRow[]) {
  const supabase = getSupabaseClient();
  if (!supabase) return rows.map((row) => mapStudent(row, [], []));

  const studentIds = rows.map((row) => row.id);
  const [{ data: badgeRows }, { data: questRows }] = await Promise.all([
    supabase.from("student_badges").select("student_id,badge_id").in("student_id", studentIds),
    supabase.from("student_quests").select("student_id,quest_id,status").in("student_id", studentIds)
  ]);

  return rows.map((row) => {
    const badgeIds = ((badgeRows ?? []) as StudentBadgeRow[])
      .filter((badge) => badge.student_id === row.id)
      .map((badge) => badge.badge_id);
    const completedQuestIds = ((questRows ?? []) as StudentQuestRow[])
      .filter((quest) => quest.student_id === row.id && quest.status === "completed")
      .map((quest) => quest.quest_id);
    return mapStudent(row, badgeIds, completedQuestIds);
  });
}

export async function getStudentsResult(): Promise<DataResult<Student[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return mockResult(mockStudents, "Supabase is not configured.");

  const { data, error } = await supabase
    .from("students")
    .select("id,display_name,public_slug,avatar_url,class_group,total_xp,level,is_active")
    .eq("is_active", true)
    .order("total_xp", { ascending: false });

  if (shouldUseMock(data, error)) return mockResult(mockStudents, error);
  return supabaseResult(await hydrateStudents(data as StudentRow[]));
}

export async function getStudents() {
  return (await getStudentsResult()).data;
}

export async function getStudentBySlug(slug: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return mockStudents.find((student) => student.slug === slug || student.lichessUsername?.toLowerCase() === slug.toLowerCase()) ?? null;

  const { data, error } = await supabase
    .from("students")
    .select("id,display_name,public_slug,avatar_url,class_group,total_xp,level,is_active")
    .eq("is_active", true)
    .eq("public_slug", slug)
    .maybeSingle();

  if (error || !data) {
    return mockStudents.find((student) => student.slug === slug || student.lichessUsername?.toLowerCase() === slug.toLowerCase()) ?? null;
  }

  return (await hydrateStudents([data as StudentRow]))[0] ?? null;
}
