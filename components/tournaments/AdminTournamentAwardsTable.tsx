"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AdminTournamentNav } from "@/components/tournaments/AdminTournamentNav";
import { mockPendingTournamentAwards } from "@/data/tournamentResults";
import { students as seedStudents } from "@/data/students";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { approveTournamentAward } from "@/lib/tournaments/approveTournamentAward";
import type { PendingTournamentAward, Student, TournamentAwardStatus, TournamentSource } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function AdminTournamentAwardsTable() {
  const [students, setStudents] = useState<Student[]>(seedStudents);
  const [awards, setAwards] = useState<PendingTournamentAward[]>([]);
  const [status, setStatus] = useState<TournamentAwardStatus | "all">("pending");
  const [studentFilter, setStudentFilter] = useState("all");
  const [tournamentFilter, setTournamentFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<TournamentSource | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [xpDrafts, setXpDrafts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Review every Arena award before XP is added.");

  useEffect(() => {
    const store = readAdminStore();
    setStudents(store.students ?? seedStudents);
    setAwards(store.pendingTournamentAwards ?? mockPendingTournamentAwards);
  }, []);

  const tournaments = useMemo(() => Array.from(new Map(awards.map((award) => [award.lichessTournamentId, award.title])).entries()), [awards]);
  const visible = useMemo(() => awards.filter((award) => (
    (status === "all" || award.status === status)
    && (studentFilter === "all" || award.studentId === studentFilter)
    && (tournamentFilter === "all" || award.lichessTournamentId === tournamentFilter)
    && (sourceFilter === "all" || award.tournamentSource === sourceFilter)
  )), [awards, sourceFilter, status, studentFilter, tournamentFilter]);

  function persist(nextAwards: PendingTournamentAward[], nextStudents = students) {
    setAwards(nextAwards);
    setStudents(nextStudents);
    updateAdminStore({ pendingTournamentAwards: nextAwards, students: nextStudents });
  }

  async function approve(award: PendingTournamentAward) {
    if (award.status !== "pending") return;
    const response = await fetch("/api/tournament-awards/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ award, xpAmount: xpDrafts[award.id] ?? award.xpAmount, teacherNote: notes[award.id] })
    });
    const data = await response.json() as { award?: PendingTournamentAward; error?: string };
    if (!response.ok || !data.award) {
      setMessage(data.error ?? "Could not approve award.");
      return;
    }
    const approved = data.award;
    const nextAwards = awards.map((item) => item.id === approved.id ? approved : item);
    const nextStudents = students.map((student) => student.id === approved.studentId ? { ...student, totalXp: student.totalXp + approved.xpAmount } : student);
    const store = readAdminStore();
    const today = new Date().toISOString().slice(0, 10);
    updateAdminStore({
      pendingTournamentAwards: nextAwards,
      students: nextStudents,
      tournamentXpEvents: [{ id: `xp-${approved.id}`, studentId: approved.studentId, amount: approved.xpAmount, reason: approved.reason, createdAt: today }, ...(store.tournamentXpEvents ?? [])],
      tournamentActivityEvents: [{ id: `activity-${approved.id}`, title: "Arena XP approved", detail: `${approved.lichessUsername} received ${approved.xpAmount} XP for ${approved.title}.`, createdAt: today }, ...(store.tournamentActivityEvents ?? [])]
    });
    setAwards(nextAwards);
    setStudents(nextStudents);
    setSelected((items) => items.filter((id) => id !== approved.id));
    setMessage(`${approved.xpAmount} XP approved for ${approved.lichessUsername}.`);
  }

  async function reject(award: PendingTournamentAward) {
    if (award.status !== "pending") return;
    const response = await fetch("/api/tournament-awards/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ award, rejectionReason: notes[award.id], teacherNote: notes[award.id] })
    });
    const data = await response.json() as { award?: PendingTournamentAward; error?: string };
    if (!response.ok || !data.award) {
      setMessage(data.error ?? "Could not reject award.");
      return;
    }
    persist(awards.map((item) => item.id === data.award!.id ? data.award! : item));
    setSelected((items) => items.filter((id) => id !== award.id));
    setMessage(`Award rejected for ${award.lichessUsername}.`);
  }

  async function bulkApprove() {
    const chosen = awards.filter((item) => selected.includes(item.id) && item.status === "pending");
    if (chosen.length === 0) return;
    const approvedById = new Map(chosen.map((award) => [
      award.id,
      approveTournamentAward(award, xpDrafts[award.id] ?? award.xpAmount, notes[award.id])
    ]));
    const nextAwards = awards.map((award) => approvedById.get(award.id) ?? award);
    const xpByStudent = new Map<string, number>();
    for (const award of approvedById.values()) xpByStudent.set(award.studentId, (xpByStudent.get(award.studentId) ?? 0) + award.xpAmount);
    const nextStudents = students.map((student) => ({ ...student, totalXp: student.totalXp + (xpByStudent.get(student.id) ?? 0) }));
    const store = readAdminStore();
    const today = new Date().toISOString().slice(0, 10);
    updateAdminStore({
      pendingTournamentAwards: nextAwards,
      students: nextStudents,
      tournamentXpEvents: [
        ...Array.from(approvedById.values(), (award) => ({ id: `xp-${award.id}`, studentId: award.studentId, amount: award.xpAmount, reason: award.reason, createdAt: today })),
        ...(store.tournamentXpEvents ?? [])
      ],
      tournamentActivityEvents: [
        ...Array.from(approvedById.values(), (award) => ({ id: `activity-${award.id}`, title: "Arena XP approved", detail: `${award.lichessUsername} received ${award.xpAmount} XP for ${award.title}.`, createdAt: today })),
        ...(store.tournamentActivityEvents ?? [])
      ]
    });
    setAwards(nextAwards);
    setStudents(nextStudents);
    setSelected([]);
    setMessage(`${chosen.length} Arena awards approved.`);
  }

  return (
    <div className="space-y-5">
      <AdminTournamentNav />
      <Card className="p-4">
        <h2 className="font-black text-white">Arena XP Approval Queue</h2>
        <p className="mt-1 text-sm text-slate-400">{message}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={status} onChange={(event) => setStatus(event.target.value as TournamentAwardStatus | "all")}>
            <option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          </select>
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
            <option value="all">All students</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
          </select>
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={tournamentFilter} onChange={(event) => setTournamentFilter(event.target.value)}>
            <option value="all">All tournaments</option>{tournaments.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as TournamentSource | "all")}>
            <option value="all">All sources</option><option value="team_sync">Team sync</option><option value="imported_url">Imported URL</option>
          </select>
        </div>
        <Button className="mt-3" onClick={bulkApprove} disabled={selected.length === 0} variant="secondary">Approve Selected</Button>
      </Card>

      {visible.map((award) => (
        <Card key={award.id} className="p-4">
          <div className="grid gap-4 lg:grid-cols-[auto_1fr_280px]">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-cyan-300" checked={selected.includes(award.id)} disabled={award.status !== "pending"} onChange={(event) => setSelected((items) => event.target.checked ? [...items, award.id] : items.filter((id) => id !== award.id))} />
            <div>
              <p className="text-xs font-black uppercase text-cyan-100">{award.status}</p>
              <h2 className="mt-1 font-black text-white">{students.find((student) => student.id === award.studentId)?.name ?? award.lichessUsername}</h2>
              <p className="mt-1 text-sm text-slate-300">{award.title}</p>
              <p className="mt-2 text-xs text-slate-400">{award.reason}</p>
            </div>
            <div className="space-y-2">
              <input type="number" min={0} disabled={award.status !== "pending"} className="w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={xpDrafts[award.id] ?? award.xpAmount} onChange={(event) => setXpDrafts((items) => ({ ...items, [award.id]: Math.max(0, Number(event.target.value) || 0) }))} />
              <textarea disabled={award.status !== "pending"} className="min-h-20 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={notes[award.id] ?? award.teacherNote ?? ""} onChange={(event) => setNotes((items) => ({ ...items, [award.id]: event.target.value }))} placeholder="Teacher note or rejection reason" />
              {award.status === "pending" && <div className="flex gap-2"><Button onClick={() => approve(award)} variant="secondary">Approve</Button><Button onClick={() => reject(award)} variant="ghost">Reject</Button></div>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
