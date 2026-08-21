"use client";

import { useEffect, useMemo, useState } from "react";
import type { StudyMember } from "@/chess/analysis/types";
import type { Student } from "@/lib/types";
import { Button } from "@/components/Button";

export function StudyMembersDialog({ studyId, onChanged, onClose }: { studyId: string; onChanged: () => void; onClose: () => void }) {
  const [members, setMembers] = useState<StudyMember[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/chess/studies/${encodeURIComponent(studyId)}/members`, { cache: "no-store" }),
      fetch("/api/admin/students", { cache: "no-store" })
    ]).then(async ([memberResponse, studentResponse]) => {
      const memberBody = await memberResponse.json().catch(() => ({})) as { members?: StudyMember[]; error?: string };
      const studentBody = await studentResponse.json().catch(() => ({})) as { students?: Student[]; error?: string };
      if (!memberResponse.ok) throw new Error(memberBody.error ?? "Study access could not be loaded.");
      if (!studentResponse.ok) throw new Error(studentBody.error ?? "Student roster could not be loaded.");
      if (cancelled) return;
      setMembers(memberBody.members ?? []);
      setStudents(studentBody.students ?? []);
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Study access could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studyId]);

  const available = useMemo(() => {
    const assigned = new Set(members.map((member) => member.studentId));
    return students.filter((student) => !assigned.has(student.id));
  }, [members, students]);
  const selectedId = available.some((student) => student.id === studentId) ? studentId : available[0]?.id ?? "";

  async function saveMember(nextStudentId: string, nextRole: "editor" | "viewer") {
    setSaving(nextStudentId);
    setError("");
    try {
      const response = await fetch(`/api/chess/studies/${encodeURIComponent(studyId)}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: nextStudentId, role: nextRole })
      });
      const body = await response.json().catch(() => ({})) as { member?: StudyMember; error?: string };
      if (!response.ok || !body.member) throw new Error(body.error ?? "Study access could not be saved.");
      setMembers((current) => [...current.filter((member) => member.studentId !== nextStudentId), body.member!]);
      setStudentId("");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Study access could not be saved.");
    } finally { setSaving(""); }
  }

  async function removeMember(member: StudyMember) {
    if (!window.confirm(`Remove ${member.name} from this study?`)) return;
    setSaving(member.studentId);
    setError("");
    try {
      const response = await fetch(`/api/chess/studies/${encodeURIComponent(studyId)}/members/${encodeURIComponent(member.studentId)}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Study access could not be removed.");
      setMembers((current) => current.filter((item) => item.studentId !== member.studentId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Study access could not be removed.");
    } finally { setSaving(""); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="study-access-title" className="w-full max-w-2xl rounded-xl border border-cyan-200/25 bg-slate-950 p-5 shadow-2xl">
      <h2 id="study-access-title" className="text-2xl font-black text-white">Manage study access</h2>
      <p className="mt-1 text-sm text-slate-400">Editors can change chapters and annotations. Viewers can open the study without changing it.</p>

      <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
        {loading ? <p className="p-4 text-sm text-slate-400">Loading access…</p> : members.length ? members.map((member) => <div key={member.studentId} className="flex flex-col gap-3 border-b border-white/5 p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-bold text-white">{member.name}</p><p className="text-xs text-slate-500">{member.lichessUsername ? `@${member.lichessUsername}` : member.slug}</p></div>
          {member.role === "owner" ? <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-100">Owner</span> : <div className="flex items-center gap-2">
            <select aria-label={`Access for ${member.name}`} value={member.role} disabled={Boolean(saving)} onChange={(event) => void saveMember(member.studentId, event.target.value as "editor" | "viewer")} className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-bold text-white"><option value="viewer">Viewer</option><option value="editor">Editor</option></select>
            <Button type="button" variant="ghost" disabled={Boolean(saving)} onClick={() => void removeMember(member)}>Remove</Button>
          </div>}
        </div>) : <p className="p-4 text-sm text-slate-400">No students have access yet.</p>}
      </div>

      {!loading && <div className="mt-4 grid gap-3 rounded-lg border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-300">Student
          <select aria-label="Student" value={selectedId} disabled={!available.length || Boolean(saving)} onChange={(event) => setStudentId(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case text-white">
            {available.length ? available.map((student) => <option key={student.id} value={student.id}>{student.name}{student.lichessUsername ? ` (@${student.lichessUsername})` : ""}</option>) : <option value="">All active students already have access</option>}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-300">Role
          <select aria-label="Role" value={role} disabled={Boolean(saving)} onChange={(event) => setRole(event.target.value as "editor" | "viewer")} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case text-white"><option value="viewer">Viewer</option><option value="editor">Editor</option></select>
        </label>
        <Button type="button" variant="secondary" disabled={!selectedId || Boolean(saving)} onClick={() => void saveMember(selectedId, role)}>{saving === selectedId ? "Adding…" : "Add student"}</Button>
      </div>}

      {error && <p className="mt-3 rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end"><Button type="button" variant="ghost" onClick={onClose}>Close</Button></div>
    </section>
  </div>;
}
