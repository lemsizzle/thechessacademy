"use server";

import { getSupabaseServerReadClient } from "@/lib/supabase/server";

export async function lookupPublicStudent(input: string): Promise<{ slug?: string; error?: string }> {
  if (typeof input !== "string") return { error: "Enter the student's Lichess username or profile slug." };
  const value = input.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_-]{1,100}$/.test(value)) return { error: "Enter a valid Lichess username or profile slug." };
  const supabase = getSupabaseServerReadClient();
  if (!supabase) return { error: "Profile lookup is temporarily unavailable. Please try again." };
  const bySlug = await supabase.from("students").select("public_slug").eq("is_active", true).eq("public_slug", value).maybeSingle();
  if (bySlug.error) return { error: "Profile lookup is temporarily unavailable. Please try again." };
  if (bySlug.data) return { slug: bySlug.data.public_slug };
  // Escape the LIKE wildcard so usernames containing underscores still match exactly.
  const byUsername = await supabase.from("students").select("public_slug").eq("is_active", true).ilike("lichess_username", value.replace(/_/g, "\\_")).maybeSingle();
  if (byUsername.error) return { error: "Profile lookup is temporarily unavailable. Please try again." };
  return byUsername.data ? { slug: byUsername.data.public_slug } : { error: "No student profile matched that Lichess username yet." };
}
