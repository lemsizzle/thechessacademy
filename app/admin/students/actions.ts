"use server";

import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { deleteSupabaseStudentById } from "@/lib/students/supabaseStudentProfiles";
import { isSupabaseProjectConfigured, isSupabaseServiceConfigured } from "@/lib/supabase/server";
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

export async function deleteAdminStudent(input: DeleteAdminStudentInput): Promise<DeleteAdminStudentResult> {
  const cookieStore = await cookies();
  const authenticated = await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(input.actionToken);
  if (!authenticated) return { ok: false, error: "Teacher log in required." };

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
