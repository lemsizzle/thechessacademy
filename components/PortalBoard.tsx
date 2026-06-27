"use client";

import { ActivityFeed } from "@/components/ActivityFeed";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ParentStudentLookup } from "@/components/ParentStudentLookup";
import { PublicPortalWelcome } from "@/components/PublicPortalWelcome";
import { StudentCard } from "@/components/StudentCard";
import { activity } from "@/data/activity";
import { findStudentLichessAccount } from "@/lib/lichessXp";
import { hasAdminSession } from "@/lib/mockStorage";
import type { ActivityEvent, Student } from "@/lib/types";
import { useMockAdminState } from "@/lib/useMockAdminState";
import { useEffect, useMemo, useState } from "react";

export function PortalBoard({ initialStudents, initialActivity }: { initialStudents?: Student[]; initialActivity?: ActivityEvent[] }) {
  const { students: adminStudents, classGroups, studentLichessAccounts } = useMockAdminState();
  const [isAdmin, setIsAdmin] = useState(false);
  const students = isAdmin ? adminStudents : initialStudents ?? adminStudents;
  const groupNames = useMemo(() => (
    Array.from(new Set(students.map((student) => student.classGroup).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
  ), [students]);

  useEffect(() => {
    setIsAdmin(hasAdminSession());
  }, []);

  return (
    <div className="space-y-6">
      <PublicPortalWelcome />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {isAdmin ? (
            <>
              <div>
                <p className="text-xs font-black uppercase text-cyan-100">Teacher roster preview</p>
                <h2 className="mt-1 text-2xl font-black text-white">Students</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-400">
                  Teacher/admin preview of public profile cards. Parents should use the private lookup instead.
                </p>
              </div>

              {students.length ? (
                groupNames.map((groupName) => {
                  const group = classGroups.find((item) => item.name === groupName);
                  const roster = students.filter((student) => student.classGroup === groupName);
                  return (
                    <section key={groupName}>
                      <Card className="mb-3 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-black text-white">{groupName}</h3>
                            <p className="text-sm text-slate-400">{roster.length} students</p>
                          </div>
                          {group?.outschoolClassUrl && (
                            <Button href={group.outschoolClassUrl} variant="secondary" target="_blank" rel="noopener noreferrer">
                              Class Link
                            </Button>
                          )}
                        </div>
                      </Card>
                      <div className="grid gap-4 md:grid-cols-2">
                        {roster.map((student) => <StudentCard key={student.id} student={student} lichessAccount={findStudentLichessAccount(student, studentLichessAccounts)} />)}
                      </div>
                    </section>
                  );
                })
              ) : (
                <EmptyState title="No students yet" message="Add students from the teacher dashboard to fill the portal." />
              )}
            </>
          ) : (
            <div className="space-y-4">
              <ParentStudentLookup initialStudents={initialStudents} />
              <Card className="p-4">
                <p className="text-xs font-black uppercase text-cyan-100">Student privacy</p>
                <h2 className="mt-1 font-black text-white">Profiles Open One At A Time</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Parents can view their own student by entering the matching Lichess username or profile slug. Other student profiles stay hidden.
                </p>
              </Card>
            </div>
          )}
        </div>
        <div className="space-y-5">
          <Card className="p-4">
            <p className="text-xs font-black uppercase text-cyan-100">Lichess Team Events</p>
            <h2 className="mt-1 font-black text-white">Upcoming Tournaments</h2>
            <p className="mt-2 text-sm text-slate-300">Upcoming Arena events from the Outschool Battleground team.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button href="/app/tournaments" variant="secondary">View Tournaments</Button>
              <Button href="https://lichess.org/team/outschool-battleground" target="_blank" rel="noopener noreferrer" variant="ghost">Open Team</Button>
            </div>
          </Card>
          <ActivityFeed events={(initialActivity ?? activity).slice(0, 3)} />
        </div>
      </div>
    </div>
  );
}
