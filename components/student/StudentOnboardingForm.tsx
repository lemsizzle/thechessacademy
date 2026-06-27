"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { classGroups } from "@/data/classGroups";
import { studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { students as seedStudents } from "@/data/students";
import { setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import type { Student, StudentLichessAccount, StudentUser } from "@/lib/types";
import { useEffect, useState } from "react";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `student-${Date.now()}`;
}

function createAccount(studentId: string, username: string): StudentLichessAccount {
  const today = new Date().toISOString().slice(0, 10);
  const seed = username.length;
  return {
    id: `lichess-account-${studentId}`,
    studentId,
    lichessUserId: username.toLowerCase(),
    lichessUsername: username,
    lichessProfileUrl: `https://lichess.org/@/${username}`,
    blitzRating: 1000 + seed * 23,
    blitzGames: 40 + seed,
    blitzRatingChange: 8,
    blitzRatingDeviation: 72,
    blitzProvisional: false,
    rapidRating: 1080 + seed * 21,
    rapidGames: 25 + seed,
    rapidRatingChange: 12,
    rapidRatingDeviation: 80,
    rapidProvisional: false,
    puzzleRating: 1200 + seed * 17,
    puzzleGames: 80 + seed,
    baselineBlitzGames: 40 + seed,
    baselineRapidGames: 25 + seed,
    baselinePuzzleGames: 80 + seed,
    activityBaselineSetAt: today,
    linkedAt: today,
    lastRatingSyncAt: today,
    lastPuzzleSyncAt: today,
    syncStatus: "mock",
    createdAt: today,
    updatedAt: today
  };
}

export function StudentOnboardingForm() {
  const [user, setUser] = useState<StudentUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [classGroup, setClassGroup] = useState(classGroups[0]?.name ?? "Unassigned");
  const [message, setMessage] = useState("Confirm your student profile to finish setup.");

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { user?: StudentUser }) => {
        if (!data.user) return;
        setUser(data.user);
        setDisplayName(data.user.name);
      })
      .catch(() => setMessage("Could not load student session."));
  }, []);

  async function complete() {
    if (!user) return;
    if (!displayName.trim()) {
      setMessage("Add a display name.");
      return;
    }

    const response = await fetch("/api/student/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, classGroup })
    });
    const data = await response.json() as { user?: StudentUser; student?: Student; redirectTo?: string; error?: string };
    if (!response.ok || !data.user) {
      setMessage(data.error ?? "Could not complete onboarding.");
      return;
    }

    const store = readAdminStore();
    const students = store.students ?? seedStudents;
    const accounts = store.studentLichessAccounts ?? seedAccounts;
    const username = user.lichessUsername ?? displayName;
    const nextStudent: Student = data.student ?? {
      id: data.user.studentId,
      slug: slugify(username),
      lichessUsername: username,
      name: displayName.trim(),
      avatar: displayName.trim().slice(0, 1).toUpperCase(),
      classGroup,
      source: "manual",
      isActive: true,
      onboardingCompleted: true,
      totalXp: 0,
      badgeIds: [],
      completedQuestIds: [],
      encouragement: "Welcome to the academy. Your Lichess account is linked and your quest board is ready."
    };
    const nextStudents = students.some((student) => student.id === nextStudent.id)
      ? students.map((student) => student.id === nextStudent.id ? { ...student, ...nextStudent } : student)
      : [nextStudent, ...students];
    const nextAccounts = accounts.some((account) => account.studentId === nextStudent.id)
      ? accounts
      : [createAccount(nextStudent.id, username), ...accounts];

    updateAdminStore({ students: nextStudents, studentLichessAccounts: nextAccounts });
    setCurrentStudentUserRecord(data.user);
    window.location.href = data.redirectTo ?? "/student/profile";
  }

  return (
    <Card className="mx-auto max-w-xl p-5">
      <h2 className="font-black text-white">Finish Student Setup</h2>
      <p className="mt-2 text-sm text-slate-300">{message}</p>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Linked Lichess Username
          <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={user?.lichessUsername ?? ""} readOnly />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Display Name
          <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Class Group
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={classGroup} onChange={(event) => setClassGroup(event.target.value)}>
            {classGroups.map((group) => <option key={group.id}>{group.name}</option>)}
            <option>Unassigned</option>
          </select>
        </label>
      </div>
      <Button className="mt-4 w-full" onClick={complete}>Complete Setup</Button>
    </Card>
  );
}
