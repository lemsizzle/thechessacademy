"use client";

import { Button } from "@/components/Button";
import { persistStudentXpChange } from "@/lib/adminXpClient";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import type { Badge, Quest, Student, XpEvent } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function SubmissionRewardsPanel({
  student,
  badges,
  quests,
  students,
  onStudentsChange,
  adminActionToken
}: {
  student?: Student;
  badges: Badge[];
  quests: Quest[];
  students: Student[];
  onStudentsChange: (students: Student[]) => void;
  adminActionToken?: string;
}) {
  const awardableBadges = useMemo(() => badges.filter((badge) => badge.isActive !== false), [badges]);
  const availableQuests = useMemo(() => quests.filter((quest) => quest.isLive !== false || quest.status !== "completed"), [quests]);
  const [badgeId, setBadgeId] = useState(awardableBadges[0]?.id ?? "");
  const [questId, setQuestId] = useState(availableQuests[0]?.id ?? quests[0]?.id ?? "");
  const [message, setMessage] = useState("Award a badge or mark a quest complete from this review.");
  const [awardingBadge, setAwardingBadge] = useState(false);

  useEffect(() => {
    if (!awardableBadges.length) return;
    if (!awardableBadges.some((badge) => badge.id === badgeId)) setBadgeId(awardableBadges[0].id);
  }, [awardableBadges, badgeId]);

  useEffect(() => {
    if (!availableQuests.length) return;
    if (!availableQuests.some((quest) => quest.id === questId)) setQuestId(availableQuests[0].id);
  }, [availableQuests, questId]);

  async function awardBadge() {
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

    setAwardingBadge(true);
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(student.id)}/badges`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(adminActionToken ? { "x-admin-action-token": adminActionToken } : {})
        },
        body: JSON.stringify({
          badgeId: badge.id,
          slug: student.slug,
          lichessUsername: student.lichessUsername,
          note: "Awarded from puzzle score review.",
          awardBadgeXp: true
        })
      });
      const data = await response.json().catch(() => ({})) as {
        awarded?: boolean;
        alreadyAwarded?: boolean;
        student?: Student;
        event?: XpEvent;
        mode?: "local-only";
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not award badge.");

      const xpFromBadge = data.event?.amount ?? (data.alreadyAwarded ? 0 : badge.xpValue);
      const savedTotalXp = data.student?.totalXp ?? Math.max(0, student.totalXp + xpFromBadge);
      const nextStudents = students.map((item) => (
        item.id === student.id
          ? { ...item, totalXp: savedTotalXp, badgeIds: Array.from(new Set([...item.badgeIds, badge.id])) }
          : item
      ));
      onStudentsChange(nextStudents);
      if (data.event) updateAdminStore({ xpEvents: [data.event, ...(readAdminStore().xpEvents ?? [])] });
      setMessage(data.alreadyAwarded ? `${student.name} already has ${badge.name}.` : `Awarded ${badge.name} and ${xpFromBadge} XP to ${student.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not award badge.");
    } finally {
      setAwardingBadge(false);
    }
  }

  async function markQuestComplete() {
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
    let savedTotalXp = student.totalXp + quest.xpReward;
    try {
      const result = await persistStudentXpChange(student, quest.xpReward, quest.title);
      savedTotalXp = result.student?.totalXp ?? savedTotalXp;
      updateAdminStore({
        xpEvents: [result.event ?? {
          id: `quest-xp-${quest.id}-${student.id}-${Date.now()}`,
          studentId: student.id,
          amount: quest.xpReward,
          reason: quest.title,
          createdAt: new Date().toISOString()
        }, ...(readAdminStore().xpEvents ?? [])]
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save quest XP.");
      return;
    }
    const nextStudents = students.map((item) => {
      if (item.id !== student.id) return item;
      return {
        ...item,
        completedQuestIds: [...(item.completedQuestIds ?? []), quest.id],
        totalXp: savedTotalXp,
        badgeIds: quest.badgeRewardId ? Array.from(new Set([...item.badgeIds, quest.badgeRewardId])) : item.badgeIds
      };
    });
    onStudentsChange(nextStudents);
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
      <p className="text-xs font-black uppercase text-cyan-100">Review Rewards</p>
      <p className="mt-1 text-xs text-slate-400">{message}</p>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Badge
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={badgeId} onChange={(event) => setBadgeId(event.target.value)}>
            {awardableBadges.map((badge) => <option key={badge.id} value={badge.id}>{badge.name}</option>)}
          </select>
        </label>
        <Button variant="secondary" onClick={awardBadge} disabled={awardingBadge || !awardableBadges.length}>
          {awardingBadge ? "Awarding..." : "Award Badge + XP"}
        </Button>
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
