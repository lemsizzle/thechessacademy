import { quests as mockQuests } from "@/data/quests";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Quest, QuestConditionType, QuestSource, QuestStatus, QuestTimeWindow, QuestType, TacticTheme } from "@/lib/types";
import { mockResult, supabaseResult, type DataResult } from "./shared";

type QuestRow = {
  id: string;
  title: string;
  description: string | null;
  type?: string | null;
  quest_type?: string | null;
  status?: string | null;
  is_live?: boolean | null;
  xp_reward: number | null;
  badge_reward_id: string | null;
  completion_url?: string | null;
  class_group?: string | null;
  category?: string | null;
  source?: string | null;
  condition_type?: string | null;
  time_window?: string | null;
  required_count?: number | null;
  required_score?: number | null;
  required_accuracy?: number | null;
  required_theme?: string | null;
  approval_required?: boolean | null;
  is_active: boolean | null;
  is_repeatable?: boolean | null;
  cooldown_days?: number | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function toQuestType(value: string): QuestType {
  return value === "boss" ? "boss" : "weekly";
}

function toQuestStatus(value: string | null | undefined, isLive: boolean): QuestStatus {
  if (value === "completed") return "completed";
  if (value === "in-progress") return "in-progress";
  if (value === "available") return "available";
  return isLive ? "available" : "completed";
}

function toQuestSource(value: string | null | undefined): QuestSource | undefined {
  if (value === "lichess_games" || value === "lichess_puzzles" || value === "lichess_tournaments" || value === "internal_submission" || value === "manual") return value;
  return undefined;
}

function toQuestConditionType(value: string | null | undefined): QuestConditionType | undefined {
  const conditions: QuestConditionType[] = [
    "rated_win_count",
    "rated_games_played_count",
    "rapid_win_count",
    "rapid_games_played_count",
    "blitz_win_count",
    "blitz_games_played_count",
    "puzzle_solved_count",
    "puzzle_attempted_count",
    "puzzle_accuracy_threshold",
    "puzzle_theme_solved_count",
    "arena_score_threshold",
    "tournament_participation",
    "rating_peak",
    "manual"
  ];
  return conditions.find((condition) => condition === value);
}

function toQuestTimeWindow(value: string | null | undefined): QuestTimeWindow | undefined {
  if (value === "daily" || value === "weekly" || value === "monthly" || value === "tournament" || value === "all_time" || value === "custom") return value;
  return undefined;
}

function mapQuest(row: QuestRow): Quest {
  const isLive = row.is_live ?? row.is_active ?? true;
  const status = toQuestStatus(row.status, isLive);

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    type: toQuestType(row.type ?? row.quest_type ?? "weekly"),
    status,
    isLive,
    xpReward: row.xp_reward ?? 0,
    badgeRewardId: row.badge_reward_id ?? undefined,
    completionUrl: row.completion_url ?? undefined,
    classGroup: row.class_group ?? undefined,
    category: row.category ?? undefined,
    source: toQuestSource(row.source),
    conditionType: toQuestConditionType(row.condition_type),
    timeWindow: toQuestTimeWindow(row.time_window),
    requiredCount: row.required_count ?? undefined,
    requiredScore: row.required_score ?? undefined,
    requiredAccuracy: row.required_accuracy ?? undefined,
    requiredTheme: row.required_theme as TacticTheme | undefined,
    approvalRequired: row.approval_required ?? undefined,
    isActive: row.is_active ?? true,
    isRepeatable: row.is_repeatable ?? undefined,
    cooldownDays: row.cooldown_days ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function getQuestsResult(): Promise<DataResult<Quest[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return mockResult(mockQuests, "Supabase is not configured.");

  const selects = [
    "id,title,description,type,status,is_live,xp_reward,badge_reward_id,completion_url,class_group,category,source,condition_type,time_window,required_count,required_score,required_accuracy,required_theme,approval_required,is_active,is_repeatable,cooldown_days,created_at,updated_at",
    "id,title,description,quest_type,xp_reward,badge_reward_id,completion_url,is_active,starts_at,ends_at,created_at,updated_at",
    "id,title,description,quest_type,xp_reward,badge_reward_id,is_active,starts_at,ends_at,created_at,updated_at"
  ];

  for (const select of selects) {
    const result = await supabase
      .from("quests")
      .select(select)
      .order("created_at", { ascending: false });

    if (!result.error && result.data?.length) return supabaseResult((result.data as unknown as QuestRow[]).map(mapQuest));
    if (!result.error && result.data) return supabaseResult([]);
  }

  return mockResult(mockQuests, "Could not read quests from Supabase.");
}

export async function getQuests() {
  return (await getQuestsResult()).data;
}
