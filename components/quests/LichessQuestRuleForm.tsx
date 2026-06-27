"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { QuestConditionBadge } from "@/components/quests/QuestConditionBadge";
import { quests as seedQuests } from "@/data/quests";
import { badges as seedBadges } from "@/data/badges";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { getConditionsForSource, questSources, questTacticThemes, questTimeWindows } from "@/lib/quests/questOptions";
import type { Quest, QuestConditionType, QuestSource, QuestTimeWindow, TacticTheme } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

function newRule(count: number): Quest {
  return {
    id: `lichess-quest-${Date.now()}`,
    title: `New Lichess Quest ${count + 1}`,
    description: "Describe the Lichess milestone.",
    type: "weekly",
    status: "available",
    isLive: true,
    category: "Lichess",
    source: "lichess_games",
    conditionType: "rapid_games_played_count",
    timeWindow: "weekly",
    requiredCount: 10,
    xpReward: 100,
    approvalRequired: true,
    isActive: true,
    isRepeatable: true,
    cooldownDays: 7
  };
}

const field = "rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white";

export function LichessQuestRuleForm() {
  const [quests, setQuests] = useState<Quest[]>(seedQuests);
  const rules = useMemo(() => quests.filter((quest) => quest.source?.startsWith("lichess_")), [quests]);
  const [selectedId, setSelectedId] = useState(rules[0]?.id ?? "");
  const selected = rules.find((quest) => quest.id === selectedId) ?? rules[0];
  const [draft, setDraft] = useState<Quest>(selected ?? newRule(0));
  const [message, setMessage] = useState("Lichess quest rules require teacher approval by default.");

  useEffect(() => {
    const stored = readAdminStore().quests ?? seedQuests;
    setQuests(stored);
    const first = stored.find((quest) => quest.source?.startsWith("lichess_"));
    if (first) {
      setSelectedId(first.id);
      setDraft(first);
    }
  }, []);

  useEffect(() => {
    if (selected) setDraft({ ...selected });
  }, [selected?.id]);

  function save(next: Quest[]) {
    setQuests(next);
    updateAdminStore({ quests: next });
  }

  function createRule() {
    const rule = newRule(rules.length);
    save([rule, ...quests]);
    setSelectedId(rule.id);
    setDraft(rule);
    setMessage("New Lichess quest rule created.");
  }

  function saveRule() {
    save(quests.map((quest) => quest.id === draft.id ? { ...draft, updatedAt: new Date().toISOString() } : quest));
    setMessage(`Saved ${draft.title}.`);
  }

  function deleteRule() {
    if (!window.confirm(`Delete ${draft.title}?`)) return;
    const next = quests.filter((quest) => quest.id !== draft.id);
    save(next);
    const first = next.find((quest) => quest.source?.startsWith("lichess_"));
    setSelectedId(first?.id ?? "");
    if (first) setDraft(first);
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="font-black text-white">Lichess Quest Rules</h2><p className="mt-1 text-sm text-slate-400">{message}</p></div>
          <Button onClick={createRule}>Create Rule</Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {rules.map((quest) => (
            <button key={quest.id} type="button" onClick={() => setSelectedId(quest.id)} className={`rounded-md border p-3 text-left ${quest.id === selectedId ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-white/5"}`}>
              <QuestConditionBadge quest={quest} />
              <p className="mt-2 font-black text-white">{quest.title}</p>
              <p className="mt-1 text-xs text-slate-400">{quest.xpReward} XP - {quest.isActive ? "Active" : "Inactive"}</p>
            </button>
          ))}
        </div>
      </Card>

      {draft && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-black text-white">Edit Rule</h2><div className="flex gap-2"><Button variant="secondary" onClick={saveRule}>Save Rule</Button><Button variant="ghost" onClick={deleteRule}>Delete</Button></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-slate-300">Title<input className={field} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">XP Reward<input className={field} type="number" value={draft.xpReward} onChange={(event) => setDraft({ ...draft, xpReward: Math.max(0, Number(event.target.value) || 0) })} /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Source<select className={field} value={draft.source} onChange={(event) => {
              const source = event.target.value as QuestSource;
              setDraft({ ...draft, source, conditionType: getConditionsForSource(source)[0]?.value ?? "manual" });
            }}>{questSources.filter((source) => source.value.startsWith("lichess_")).map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Condition<select className={field} value={draft.conditionType} onChange={(event) => setDraft({ ...draft, conditionType: event.target.value as QuestConditionType })}>{getConditionsForSource(draft.source).map((condition) => <option key={condition.value} value={condition.value}>{condition.label}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Time Window<select className={field} value={draft.timeWindow} onChange={(event) => setDraft({ ...draft, timeWindow: event.target.value as QuestTimeWindow })}>{questTimeWindows.map((window) => <option key={window}>{window}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Required Count<input className={field} type="number" value={draft.requiredCount ?? 0} onChange={(event) => setDraft({ ...draft, requiredCount: Math.max(0, Number(event.target.value) || 0) })} /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Required Score<input className={field} type="number" value={draft.requiredScore ?? 0} onChange={(event) => setDraft({ ...draft, requiredScore: Math.max(0, Number(event.target.value) || 0) })} /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Required Accuracy %<input className={field} type="number" min={0} max={100} value={draft.requiredAccuracy ?? 0} onChange={(event) => setDraft({ ...draft, requiredAccuracy: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Required Theme<select className={field} value={draft.requiredTheme ?? ""} onChange={(event) => setDraft({ ...draft, requiredTheme: (event.target.value || undefined) as TacticTheme | undefined })}><option value="">Any theme</option>{questTacticThemes.map((theme) => <option key={theme}>{theme}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Badge Reward<select className={field} value={draft.badgeRewardId ?? ""} onChange={(event) => setDraft({ ...draft, badgeRewardId: event.target.value || undefined })}><option value="">No badge reward</option>{seedBadges.map((badge) => <option key={badge.id} value={badge.id}>{badge.name}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Cooldown Days<input className={field} type="number" value={draft.cooldownDays ?? 0} onChange={(event) => setDraft({ ...draft, cooldownDays: Math.max(0, Number(event.target.value) || 0) })} /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300 md:col-span-2">Description<textarea className={`${field} min-h-24`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-300"><input type="checkbox" checked={draft.isActive !== false} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />Active</label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-300"><input type="checkbox" checked={draft.isLive === true} onChange={(event) => setDraft({ ...draft, isLive: event.target.checked })} />Live for students</label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-300"><input type="checkbox" checked={draft.isRepeatable === true} onChange={(event) => setDraft({ ...draft, isRepeatable: event.target.checked })} />Repeatable</label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-300"><input type="checkbox" checked={draft.approvalRequired !== false} onChange={(event) => setDraft({ ...draft, approvalRequired: event.target.checked })} />Teacher approval required</label>
          </div>
        </Card>
      )}
    </div>
  );
}
