import { quests as mockQuests } from "@/data/quests";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Quest, QuestStatus, QuestType } from "@/lib/types";
import { mockResult, shouldUseMock, supabaseResult, type DataResult } from "./shared";

type QuestRow = {
  id: string;
  title: string;
  description: string | null;
  quest_type: string;
  xp_reward: number | null;
  badge_reward_id: string | null;
  is_active: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function toQuestType(value: string): QuestType {
  return value === "boss" ? "boss" : "weekly";
}

function mapQuest(row: QuestRow): Quest {
  const isLive = row.is_active ?? true;
  const status: QuestStatus = isLive ? "available" : "completed";

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    type: toQuestType(row.quest_type),
    status,
    isLive,
    xpReward: row.xp_reward ?? 0,
    badgeRewardId: row.badge_reward_id ?? undefined,
    isActive: row.is_active ?? true,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function getQuestsResult(): Promise<DataResult<Quest[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return mockResult(mockQuests, "Supabase is not configured.");

  const { data, error } = await supabase
    .from("quests")
    .select("id,title,description,quest_type,xp_reward,badge_reward_id,is_active,starts_at,ends_at,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (shouldUseMock(data, error)) return mockResult(mockQuests, error);
  return supabaseResult((data as QuestRow[]).map(mapQuest));
}

export async function getQuests() {
  return (await getQuestsResult()).data;
}
