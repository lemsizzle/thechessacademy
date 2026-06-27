"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { QuestEvidenceCard } from "@/components/quests/QuestEvidenceCard";
import { badges as seedBadges } from "@/data/badges";
import { studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { quests as seedQuests } from "@/data/quests";
import { students as seedStudents } from "@/data/students";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { approveQuestAward } from "@/lib/quests/approveQuestAward";
import type { LichessActivitySnapshot, LichessQuestProgress, PendingQuestAward, PendingQuestAwardStatus, QuestCompletionEvent, Student } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type QuestEvaluationResponse = {
  evaluations?: Array<{
    progress: LichessQuestProgress[];
    newAwards: PendingQuestAward[];
    autoApprovedAwards?: PendingQuestAward[];
    autoCompletions?: QuestCompletionEvent[];
    snapshots: LichessActivitySnapshot[];
  }>;
  error?: string;
};

export function AdminLichessQuestAwardsTable() {
  const [students, setStudents] = useState<Student[]>(seedStudents);
  const [awards, setAwards] = useState<PendingQuestAward[]>([]);
  const [status, setStatus] = useState<PendingQuestAwardStatus | "all">("pending");
  const [selected, setSelected] = useState<string[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Evaluate linked students, then review every reward before it changes XP or badges.");
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    const store = readAdminStore();
    setStudents(store.students ?? seedStudents);
    setAwards(store.pendingQuestAwards ?? []);
  }, []);

  const visible = useMemo(() => awards.filter((award) => status === "all" || award.status === status), [awards, status]);

  async function evaluateAll() {
    setEvaluating(true);
    try {
      const store = readAdminStore();
      const nextStudents = store.students ?? seedStudents;
      const accounts = store.studentLichessAccounts ?? seedAccounts;
      const quests = (store.quests ?? seedQuests).filter((quest) => quest.isActive !== false && quest.source?.startsWith("lichess_"));
      const response = await fetch("/api/lichess/quests/evaluate/all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students: nextStudents.map((student) => ({
            studentId: student.id,
            username: student.lichessUsername ?? student.slug,
            account: accounts.find((account) => account.studentId === student.id),
            arenaResults: (store.arenaTournamentResults ?? []).filter((result) => result.studentId === student.id)
          })),
          quests,
          existingAwards: store.pendingQuestAwards ?? [],
          completionEvents: store.questCompletionEvents ?? [],
          timeZone: "America/Vancouver"
        })
      });
      const data = await response.json() as QuestEvaluationResponse;
      if (!response.ok || !data.evaluations) throw new Error(data.error ?? "Could not evaluate quest rules.");
      const newAwards = data.evaluations.flatMap((evaluation) => evaluation.newAwards);
      const autoApprovedAwards = data.evaluations.flatMap((evaluation) => evaluation.autoApprovedAwards ?? []);
      const autoCompletions = data.evaluations.flatMap((evaluation) => evaluation.autoCompletions ?? []);
      const nextAwards = [...newAwards, ...(store.pendingQuestAwards ?? [])];
      const badges = store.badges ?? seedBadges;
      const today = new Date().toISOString().slice(0, 10);
      const updatedStudents = nextStudents.map((student) => {
        const studentAwards = autoApprovedAwards.filter((award) => award.studentId === student.id);
        return studentAwards.reduce((next, award) => ({
          ...next,
          totalXp: next.totalXp + award.xpAmount,
          badgeIds: award.badgeId && badges.some((badge) => badge.id === award.badgeId) ? Array.from(new Set([...next.badgeIds, award.badgeId])) : next.badgeIds,
          completedQuestIds: Array.from(new Set([...(next.completedQuestIds ?? []), award.questId]))
        }), student);
      });
      updateAdminStore({
        pendingQuestAwards: nextAwards,
        students: updatedStudents,
        questCompletionEvents: [...autoCompletions, ...(store.questCompletionEvents ?? [])],
        questXpEvents: [...autoApprovedAwards.map((award) => ({ id: `xp-${award.id}`, studentId: award.studentId, amount: award.xpAmount, reason: award.title, createdAt: today })), ...(store.questXpEvents ?? [])],
        questActivityEvents: [...autoApprovedAwards.map((award) => ({ id: `activity-${award.id}`, title: "Lichess quest auto-completed", detail: `${award.title} awarded ${award.xpAmount} XP.`, createdAt: today })), ...(store.questActivityEvents ?? [])],
        lichessQuestProgress: data.evaluations.flatMap((evaluation) => evaluation.progress ?? []),
        lichessActivitySnapshots: data.evaluations.flatMap((evaluation) => evaluation.snapshots ?? [])
      });
      setAwards(nextAwards);
      setStudents(updatedStudents);
      setMessage(`${nextStudents.length} students evaluated. ${autoCompletions.length} auto-completed, ${newAwards.length} sent for approval.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not evaluate quest rules.");
    } finally {
      setEvaluating(false);
    }
  }

  async function approve(award: PendingQuestAward) {
    if (award.status !== "pending") return;
    const response = await fetch("/api/lichess/quest-awards/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ award })
    });
    const data = await response.json() as { award?: PendingQuestAward; completion?: QuestCompletionEvent; error?: string };
    if (!response.ok || !data.award || !data.completion) {
      setMessage(data.error ?? "Could not approve quest award.");
      return;
    }
    const store = readAdminStore();
    const badges = store.badges ?? seedBadges;
    const nextAwards = awards.map((item) => item.id === award.id ? data.award! : item);
    const nextStudents = students.map((student) => student.id === award.studentId ? {
      ...student,
      totalXp: student.totalXp + award.xpAmount,
      badgeIds: award.badgeId && badges.some((badge) => badge.id === award.badgeId) ? Array.from(new Set([...student.badgeIds, award.badgeId])) : student.badgeIds,
      completedQuestIds: Array.from(new Set([...(student.completedQuestIds ?? []), award.questId]))
    } : student);
    const today = new Date().toISOString().slice(0, 10);
    updateAdminStore({
      pendingQuestAwards: nextAwards,
      students: nextStudents,
      questCompletionEvents: [data.completion, ...(store.questCompletionEvents ?? [])],
      questXpEvents: [{ id: `xp-${award.id}`, studentId: award.studentId, amount: award.xpAmount, reason: award.title, createdAt: today }, ...(store.questXpEvents ?? [])],
      questActivityEvents: [{ id: `activity-${award.id}`, title: "Lichess quest approved", detail: `${award.title} awarded ${award.xpAmount} XP.`, createdAt: today }, ...(store.questActivityEvents ?? [])]
    });
    setAwards(nextAwards);
    setStudents(nextStudents);
    setSelected((items) => items.filter((id) => id !== award.id));
    setMessage(`${award.title} approved.`);
  }

  async function reject(award: PendingQuestAward) {
    const response = await fetch("/api/lichess/quest-awards/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ award, rejectionReason: reasons[award.id] })
    });
    const data = await response.json() as { award?: PendingQuestAward; error?: string };
    if (!response.ok || !data.award) return setMessage(data.error ?? "Could not reject quest award.");
    const next = awards.map((item) => item.id === award.id ? data.award! : item);
    setAwards(next);
    updateAdminStore({ pendingQuestAwards: next });
  }

  async function approveSelected() {
    const chosen = awards.filter((item) => selected.includes(item.id) && item.status === "pending");
    if (!chosen.length) return;
    const approved = chosen.map((award) => approveQuestAward(award));
    const approvedById = new Map(approved.map((item) => [item.award.id, item]));
    const store = readAdminStore();
    const badges = store.badges ?? seedBadges;
    const nextAwards = awards.map((award) => approvedById.get(award.id)?.award ?? award);
    const nextStudents = students.map((student) => {
      const studentAwards = approved.filter((item) => item.award.studentId === student.id);
      return studentAwards.reduce((next, item) => ({
        ...next,
        totalXp: next.totalXp + item.award.xpAmount,
        badgeIds: item.award.badgeId && badges.some((badge) => badge.id === item.award.badgeId) ? Array.from(new Set([...next.badgeIds, item.award.badgeId])) : next.badgeIds,
        completedQuestIds: Array.from(new Set([...(next.completedQuestIds ?? []), item.award.questId]))
      }), student);
    });
    const today = new Date().toISOString().slice(0, 10);
    updateAdminStore({
      pendingQuestAwards: nextAwards,
      students: nextStudents,
      questCompletionEvents: [...approved.map((item) => item.completion), ...(store.questCompletionEvents ?? [])],
      questXpEvents: [...approved.map((item) => ({ id: `xp-${item.award.id}`, studentId: item.award.studentId, amount: item.award.xpAmount, reason: item.award.title, createdAt: today })), ...(store.questXpEvents ?? [])],
      questActivityEvents: [...approved.map((item) => ({ id: `activity-${item.award.id}`, title: "Lichess quest approved", detail: `${item.award.title} awarded ${item.award.xpAmount} XP.`, createdAt: today })), ...(store.questActivityEvents ?? [])]
    });
    setAwards(nextAwards);
    setStudents(nextStudents);
    setSelected([]);
    setMessage(`${chosen.length} quest awards approved.`);
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="font-black text-white">Lichess Quest Awards</h2><p className="mt-1 text-sm text-slate-400">{message}</p></div>
          <div className="flex flex-wrap gap-2"><Button onClick={evaluateAll} disabled={evaluating} variant="secondary">{evaluating ? "Evaluating..." : "Evaluate All Students"}</Button><Button onClick={approveSelected} disabled={!selected.length}>Approve Selected</Button></div>
        </div>
        <select className="mt-4 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={status} onChange={(event) => setStatus(event.target.value as PendingQuestAwardStatus | "all")}>
          <option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
      </Card>
      {visible.map((award) => (
        <Card key={award.id} className="p-4">
          <div className="grid gap-4 lg:grid-cols-[auto_1fr_280px]">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-cyan-300" disabled={award.status !== "pending"} checked={selected.includes(award.id)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, award.id] : items.filter((id) => id !== award.id))} />
            <div>
              <p className="text-xs font-black uppercase text-cyan-100">{award.status} - {award.source.replaceAll("_", " ")}</p>
              <h2 className="mt-1 font-black text-white">{students.find((student) => student.id === award.studentId)?.name ?? award.studentId}: {award.title}</h2>
              <p className="mt-1 text-sm text-amber-100">{award.xpAmount} XP{award.badgeId ? ` + badge ${award.badgeId}` : ""}</p>
              <div className="mt-3"><QuestEvidenceCard award={award} /></div>
            </div>
            {award.status === "pending" && <div className="space-y-2"><textarea className="min-h-20 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" placeholder="Rejection reason" value={reasons[award.id] ?? ""} onChange={(event) => setReasons((items) => ({ ...items, [award.id]: event.target.value }))} /><div className="flex gap-2"><Button variant="secondary" onClick={() => approve(award)}>Approve</Button><Button variant="ghost" onClick={() => reject(award)}>Reject</Button></div></div>}
          </div>
        </Card>
      ))}
      {!visible.length && <Card className="p-4 text-sm text-slate-300">No quest awards match this filter.</Card>}
    </div>
  );
}
