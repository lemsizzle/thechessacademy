import "server-only";

import { mapSupabaseQuest, type QuestRow } from "@/lib/data/quests";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Quest } from "@/lib/types";

const questSelect = "id,title,description,type,status,is_live,xp_reward,badge_reward_id,completion_url,class_group,category,source,condition_type,time_window,required_count,required_score,required_accuracy,required_theme,approval_required,is_active,is_repeatable,cooldown_days,created_at,updated_at";

function questPayload(quest: Quest) {
  return {
    id: quest.id,
    title: quest.title.trim(),
    description: quest.description.trim(),
    type: quest.type,
    status: quest.status,
    is_live: quest.isLive === true,
    xp_reward: Math.max(0, Number(quest.xpReward) || 0),
    badge_reward_id: quest.badgeRewardId || null,
    completion_url: quest.completionUrl?.trim() || null,
    class_group: quest.classGroup?.trim() || null,
    category: quest.category?.trim() || null,
    source: quest.source ?? "manual",
    condition_type: quest.conditionType ?? "manual",
    time_window: quest.timeWindow ?? null,
    required_count: quest.requiredCount ?? null,
    required_score: quest.requiredScore ?? null,
    required_accuracy: quest.requiredAccuracy ?? null,
    required_theme: quest.requiredTheme ?? null,
    approval_required: quest.approvalRequired !== false,
    is_active: quest.isActive !== false,
    is_repeatable: quest.isRepeatable === true,
    cooldown_days: Math.max(0, Number(quest.cooldownDays) || 0)
  };
}

function validateQuest(quest: Quest) {
  if (!quest.id?.trim()) throw new Error("Quest id is required.");
  if (!quest.title?.trim()) throw new Error("Quest title is required.");
  if (quest.source?.startsWith("lichess_") && !quest.conditionType) {
    throw new Error("Choose a Lichess goal before saving this quest.");
  }
}

export async function listAdminQuests() {
  const { data, error } = await getSupabaseAdminClient()
    .from("academy_quests")
    .select(questSelect)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as QuestRow[]).map(mapSupabaseQuest);
}

export async function saveAdminQuest(quest: Quest) {
  validateQuest(quest);
  const { data, error } = await getSupabaseAdminClient()
    .from("academy_quests")
    .upsert(questPayload(quest), { onConflict: "id" })
    .select(questSelect)
    .single();
  if (error) throw new Error(error.message);
  return mapSupabaseQuest(data as unknown as QuestRow);
}

export async function deleteAdminQuest(id: string) {
  const { error } = await getSupabaseAdminClient()
    .from("academy_quests")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
