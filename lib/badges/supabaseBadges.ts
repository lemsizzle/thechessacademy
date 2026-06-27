import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Badge, BadgeCategory, BadgeTier, GenerationStatus, TacticTheme } from "@/lib/types";

export type SupabaseBadgeRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tier: string | null;
  xp_value: number | null;
  unlock_requirement: string | null;
  visual_theme: string | null;
  art_image_url: string | null;
  final_image_url: string | null;
  generation_status: string | null;
  generation_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BadgeWriteInput = Partial<Badge> & {
  name?: string;
  description?: string;
  category?: BadgeCategory;
};

export const badgeSelect = "id,name,description,category,tier,xp_value,unlock_requirement,visual_theme,art_image_url,final_image_url,generation_status,generation_error,created_at,updated_at";

export function toGenerationStatus(status: string | null | undefined): GenerationStatus {
  if (status === "generated" || status === "selected" || status === "error" || status === "idle" || status === "pending") return status;
  return status === "failed" ? "error" : "pending";
}

export function toBadgeCategory(category: string): BadgeCategory {
  if (category === "Concept Badges") return "Concepts";
  if (category === "Concepts") return "Concepts";
  return category as BadgeCategory;
}

export function toBadgeTier(tier: string | null | undefined): BadgeTier | undefined {
  if (!tier) return undefined;
  if (tier === "C") return "Bronze";
  if (tier === "B") return "Silver";
  if (tier === "A") return "Gold";
  if (tier === "S") return "Platinum";
  return tier as BadgeTier;
}

function toSupabaseTier(tier: BadgeTier | undefined, category?: BadgeCategory) {
  if (category === "Concepts") return "C";
  if (tier === "Bronze" || tier === "C" || !tier) return "C";
  if (tier === "Silver" || tier === "B") return "B";
  if (tier === "Gold" || tier === "A") return "A";
  if (tier === "Platinum" || tier === "S") return "S";
  return "C";
}

function inferTacticTheme(name: string, category: string): TacticTheme | undefined {
  if (category !== "Tactics" && category !== "Checkmates") return undefined;
  const lower = name.toLowerCase();
  if (lower.includes("fork")) return "Fork";
  if (lower.includes("pin")) return "Pin";
  if (lower.includes("skewer")) return "Skewer";
  if (lower.includes("discovered")) return "Discovered Attack";
  if (lower.includes("double attack")) return "Double Attack";
  if (lower.includes("deflection")) return "Deflection";
  if (lower.includes("decoy")) return "Decoy";
  if (lower.includes("removing")) return "Removing the Defender";
  if (lower.includes("back rank")) return "Back Rank Mate";
  if (lower.includes("mate")) return "Mate in One";
  return undefined;
}

export function mapSupabaseBadge(row: SupabaseBadgeRow): Badge {
  const category = toBadgeCategory(row.category);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category,
    tacticTheme: inferTacticTheme(row.name, category),
    tier: category === "Concepts" ? undefined : toBadgeTier(row.tier),
    xpValue: row.xp_value ?? 0,
    unlockRequirement: row.unlock_requirement ?? "Teacher-awarded achievement.",
    visualTheme: row.visual_theme ?? "magical chess academy emblem",
    artImageUrl: row.art_image_url,
    finalImageUrl: row.final_image_url,
    generationStatus: toGenerationStatus(row.generation_status),
    generationError: row.generation_error ?? undefined,
    isActive: true,
    isLegacy: false,
    createdAt: row.created_at ?? undefined
  };
}

export function badgeToSupabasePayload(input: BadgeWriteInput) {
  return {
    name: input.name?.trim(),
    description: input.description?.trim() ?? "",
    category: input.category,
    tier: toSupabaseTier(input.tier, input.category),
    xp_value: Number(input.xpValue ?? 0),
    unlock_requirement: input.unlockRequirement?.trim() ?? "",
    visual_theme: input.visualTheme?.trim() ?? "",
    art_image_url: input.artImageUrl ?? null,
    final_image_url: input.finalImageUrl ?? null,
    generation_status: input.generationStatus ?? "pending",
    generation_error: input.generationError ?? null
  };
}

export function validateBadgeInput(input: BadgeWriteInput) {
  if (!input.name?.trim()) return "Badge name is required.";
  if (!input.category) return "Badge category is required.";
  if (Number(input.xpValue ?? 0) < 0) return "XP value cannot be negative.";
  return null;
}

export async function listAdminBadges() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("badges")
    .select(badgeSelect)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as SupabaseBadgeRow[]).map(mapSupabaseBadge);
}

export async function createAdminBadge(input: BadgeWriteInput) {
  const validationError = validateBadgeInput(input);
  if (validationError) throw new Error(validationError);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("badges")
    .insert(badgeToSupabasePayload(input))
    .select(badgeSelect)
    .single();

  if (error) throw new Error(error.message);
  return mapSupabaseBadge(data as SupabaseBadgeRow);
}

export async function updateAdminBadge(id: string, input: BadgeWriteInput) {
  const validationError = validateBadgeInput(input);
  if (validationError) throw new Error(validationError);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("badges")
    .update(badgeToSupabasePayload(input))
    .eq("id", id)
    .select(badgeSelect)
    .single();

  if (error) throw new Error(error.message);
  return mapSupabaseBadge(data as SupabaseBadgeRow);
}

export async function deleteAdminBadge(id: string) {
  const supabase = getSupabaseAdminClient();
  const { count, error: countError } = await supabase
    .from("student_badges")
    .select("id", { count: "exact", head: true })
    .eq("badge_id", id);

  if (countError) throw new Error(countError.message);

  const { error } = await supabase
    .from("badges")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  return { assignedCount: count ?? 0 };
}
