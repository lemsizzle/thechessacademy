"use server";

import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import {
  createAcademyStudentCredential,
  normalizeStudentUsername,
  validateStudentUsername
} from "@/lib/auth/studentCredentials";
import { deleteSupabaseStudentById } from "@/lib/students/supabaseStudentProfiles";
import {
  getSupabaseServiceClient,
  isSupabaseProjectConfigured,
  isSupabaseServiceConfigured
} from "@/lib/supabase/server";
import { cookies } from "next/headers";

export type DeleteAdminStudentInput = {
  id: string;
  slug?: string;
  lichessUsername?: string;
  actionToken?: string;
};

export type DeleteAdminStudentResult = {
  ok: boolean;
  deleted?: boolean;
  skipped?: boolean;
  count?: number;
  mode?: "local-only";
  error?: string;
};

export type CreateAdminStudentInput = {
  displayName: string;
  classGroup?: string;
  username: string;
  password: string;
  lichessUsername?: string;
  actionToken?: string;
};

export type CreateAdminStudentResult = {
  ok: boolean;
  studentId?: string;
  username?: string;
  error?: string;
};

async function teacherIsAuthenticated(actionToken?: string) {
  const cookieStore = await cookies();
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(actionToken);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `student-${Date.now()}`;
}

async function uniqueStudentSlug(baseValue: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const base = slugify(baseValue);
  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const { data, error } = await supabase
      .from("students")
      .select("id")
      .eq("public_slug", candidate)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return candidate;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createAdminStudent(
  input: CreateAdminStudentInput
): Promise<CreateAdminStudentResult> {
  if (!input || typeof input !== "object") return { ok: false, error: "Student details are required." };
  if (!await teacherIsAuthenticated(input.actionToken)) {
    return { ok: false, error: "Teacher log in required." };
  }

  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "Supabase service role is required to create students." };
  }

  if (typeof input.displayName !== "string" || typeof input.username !== "string" || typeof input.password !== "string"
    || (input.classGroup !== undefined && typeof input.classGroup !== "string")
    || (input.lichessUsername !== undefined && typeof input.lichessUsername !== "string")) return { ok: false, error: "Invalid student details." };
  const displayName = input.displayName.trim();
  const username = normalizeStudentUsername(input.username);
  const classGroup = input.classGroup?.trim() || "Unassigned";
  const lichessUsername = input.lichessUsername?.trim() || null;

  if (!displayName) return { ok: false, error: "Student name is required." };
  if (displayName.length > 80 || classGroup.length > 80) return { ok: false, error: "Name and class must be at most 80 characters." };
  if (lichessUsername && !/^[a-zA-Z0-9_-]{2,30}$/.test(lichessUsername)) return { ok: false, error: "Enter a valid Lichess username." };
  if (input.password.length > 256) return { ok: false, error: "Password must be at most 256 characters." };
  if (!validateStudentUsername(username)) {
    return {
      ok: false,
      error: "Username must be 3–24 characters using only letters, numbers, underscores, or hyphens."
    };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase service role is not configured." };

  let studentId: string | null = null;

  try {
    const existing = await supabase.from("student_login_credentials").select("student_id").eq("username", username).maybeSingle();
    if (existing.error) throw new Error("Could not check username availability.");
    if (existing.data) return { ok: false, error: "That username is already in use." };
    if (lichessUsername) {
      const linked = await supabase.from("students").select("id").ilike("lichess_username", lichessUsername).maybeSingle();
      if (linked.error) throw new Error("Could not check Lichess account.");
      if (linked.data) return { ok: false, error: "That Lichess account already belongs to a student." };
    }
    const publicSlug = await uniqueStudentSlug(displayName);

    const { data: student, error: studentError } = await supabase
      .from("students")
      .insert({
        display_name: displayName,
        public_slug: publicSlug,
        avatar_url: null,
        class_group: classGroup,
        total_xp: 0,
        level: 1,
        is_active: true,
        lichess_id: null,
        lichess_username: lichessUsername
      })
      .select("id")
      .single();

    if (studentError) throw new Error(studentError.message);
    studentId = String(student.id);

    await createAcademyStudentCredential(studentId, username, input.password);

    return {
      ok: true,
      studentId,
      username
    };
  } catch (error) {
    if (studentId) {
      const cleanup = await supabase.from("students").delete().eq("id", studentId);
      if (cleanup.error) return { ok: false, error: "Login creation failed and the student profile could not be removed. Refresh the roster and contact support before retrying." };
    }

    return {
      ok: false,
      error: error instanceof Error && error.message === "That username is already in use." ? error.message : "Could not create student. Please try again."
    };
  }
}

export async function deleteAdminStudent(input: DeleteAdminStudentInput): Promise<DeleteAdminStudentResult> {
  if (!await teacherIsAuthenticated(input.actionToken)) {
    return { ok: false, error: "Teacher log in required." };
  }

  if (!input.id) return { ok: false, error: "Missing student id." };

  if (!isSupabaseProjectConfigured()) {
    return { ok: true, deleted: false, mode: "local-only" };
  }

  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is required to delete students from Supabase." };
  }

  try {
    const result = await deleteSupabaseStudentById(input.id, {
      slug: input.slug,
      lichessUsername: input.lichessUsername
    });
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete student from Supabase."
    };
  }
}
