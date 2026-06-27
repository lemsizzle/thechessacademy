import { allBadges as mockBadges } from "@/data/badges";
import { students as mockStudents } from "@/data/students";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Badge, BadgeCategory, BadgeTier, GenerationStatus, TacticTheme } from "@/lib/types";
import { mockResult, shouldUseMock, supabaseResult, type DataResult } from "./shared";

type BadgeRow = {
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
  created_at: string | null;
};

function toGenerationStatus(status: string | null): GenerationStatus {
  if (status === "generated" || status === "selected" || status === "error" || status === "idle") return status;
  return status === "failed" ? "error" : "pending";
}

function toBadgeCategory(category: string): BadgeCategory {
  if (category === "Concept Badges") return "Concepts";
  if (category === "Concepts") return "Concepts";
  return category as BadgeCategory;
}

function toBadgeTier(tier: string | null): BadgeTier | undefined {
  if (!tier) return undefined;
  if (tier === "C") return "Bronze";
  if (tier === "B") return "Silver";
  if (tier === "A") return "Gold";
  if (tier === "S") return "Platinum";
  return tier as BadgeTier;
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

function mapBadge(row: BadgeRow): Badge {
  const category = toBadgeCategory(row.category);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category,
    tacticTheme: inferTacticTheme(row.name, category),
    tier: toBadgeTier(row.tier),
    xpValue: row.xp_value ?? 0,
    unlockRequirement: row.unlock_requirement ?? "Teacher-awarded achievement.",
    visualTheme: row.visual_theme ?? "magical chess academy emblem",
    artImageUrl: row.art_image_url,
    finalImageUrl: row.final_image_url,
    generationStatus: toGenerationStatus(row.generation_status),
    isActive: true,
    isLegacy: false,
    createdAt: row.created_at ?? undefined
  };
}

export async function getBadgesResult(): Promise<DataResult<Badge[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return mockResult(mockBadges, "Supabase is not configured.");

  const { data, error } = await supabase
    .from("badges")
    .select("id,name,description,category,tier,xp_value,unlock_requirement,visual_theme,art_image_url,final_image_url,generation_status,created_at")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (shouldUseMock(data, error)) return mockResult(mockBadges, error);
  return supabaseResult((data as BadgeRow[]).map(mapBadge));
}

export async function getBadges() {
  return (await getBadgesResult()).data;
}

export async function getStudentBadges(studentId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const student = mockStudents.find((item) => item.id === studentId);
    return mockBadges.filter((badge) => student?.badgeIds.includes(badge.id));
  }

  const { data, error } = await supabase
    .from("student_badges")
    .select("badges(id,name,description,category,tier,xp_value,unlock_requirement,visual_theme,art_image_url,final_image_url,generation_status,created_at)")
    .eq("student_id", studentId);

  if (error || !data) return [];

  return data
    .map((row) => row.badges)
    .filter(Boolean)
    .map((row) => mapBadge(row as unknown as BadgeRow));
}
