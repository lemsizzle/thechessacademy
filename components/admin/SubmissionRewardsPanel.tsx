"use client";

import { Button } from "@/components/Button";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import type { Badge, Quest, Student } from "@/lib/types";
import { useMemo, useState } from "react";

export function SubmissionRewardsPanel({
  student,
  badges,
  quests,
  students,
  onStudentsChange
}: {
  student?: Student;
  badges: Badge[];
  quests: Quest[];
  students: Student[];
  onStudentsChange: (students: Student[]) => void;
}) {
  const awardableBadges = useMemo(() => badges.filter((badge) => badge.isActive !== false), [badges]);
  const availableQuests = useMemo(() => quests.filter((quest) => quest.isLive !== false || quest.status !== "completed"), [quests]);
  const [badgeId, setBadgeId] = useState(awardableBadges[0]?.id ?? "");
  const [questId, setQuestId] = useState(availableQuests[0]?.id ?? quests[0]?.id ?? "");
  const [message, setMessage] = useState("Award a badge or mark a quest complete from this review.");

  function awardBadge() {
    if (!student) return;
    const badge = awardableBadges.find((item) => item.id === badgeId);
    if (!badge) {
      setMessage("Choose a badge first.");
      return;
    }
    if (student.badgeIds.includes(badge.id)) {
      setMessage(`${student.name} already has ${badge.name}.`);
      return;
    }
    const nextStudents = students.map((item) => (
      item.id === student.id ? { ...item, badgeIds: [...item.badgeIds, badge.id] } : item
    ));
    onStudentsChange(nextStudents);
    setMessage(`Awarded ${badge.name} to ${student.name}.`);
  }

  function markQuestComplete() {
    if (!student) return;
    const quest = quests.find((item) => item.id === questId);
    if (!quest) {
      setMessage("Choose a quest first.");
      return;
    }
    const alreadyComplete = student.completedQuestIds?.includes(quest.id) ?? false;
    if (alreadyComplete) {
      setMessage(`${student.name} already completed ${quest.title}.`);
      return;
    }
    const nextStudents = students.map((item) => {
      if (item.id !== student.id) return item;
      return {
        ...item,
        completedQuestIds: [...(item.completedQuestIds ?? []), quest.id],
        totalXp: item.totalXp + quest.xpReward,
        badgeIds: quest.badgeRewardId ? Array.from(new Set([...item.badgeIds, quest.badgeRewardId])) : item.badgeIds
      };
    });
    onStudentsChange(nextStudents);
    updateAdminStore({
      questXpEvents: [{
        id: `quest-xp-${quest.id}-${student.id}-${Date.now()}`,
        studentId: student.id,
        amount: quest.xpReward,
        reason: quest.title,
        createdAt: new Date().toISOString()
      }, ...(readAdminStore().questXpEvents ?? [])]
    });
    setMessage(`Marked ${quest.title} complete for ${student.name}.`);
  }

  if (!student) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
        Select a valid student before awarding badges or quests.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-black uppercase text-cyan-100">Progress Rewards</p>
      <p className="mt-1 text-xs text-slate-400">{message}</p>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Badge
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={badgeId} onChange={(event) => setBadgeId(event.target.value)}>
            {awardableBadges.map((badge) => <option key={badge.id} value={badge.id}>{badge.name}</option>)}
          </select>
        </label>
        <Button variant="secondary" onClick={awardBadge}>Award Badge</Button>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Quest
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={questId} onChange={(event) => setQuestId(event.target.value)}>
            {quests.map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}
          </select>
        </label>
        <Button variant="secondary" onClick={markQuestComplete}>Mark Quest Complete</Button>
      </div>
    </div>
  );
}
