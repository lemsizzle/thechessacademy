"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { grantParentStudentProfileAccess } from "@/lib/publicStudentAccess";
import type { Student } from "@/lib/types";
import { useMockAdminState } from "@/lib/useMockAdminState";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function normalizeUsername(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function ParentStudentLookup({ initialStudents }: { initialStudents?: Student[] }) {
  const router = useRouter();
  const { students, loaded } = useMockAdminState();
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  const searchableStudents = useMemo(() => (
    (initialStudents ?? students).filter((student) => student.isActive !== false)
  ), [initialStudents, students]);

  function openStudentProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = normalizeUsername(username);
    if (!query) {
      setMessage("Enter the student's Lichess username.");
      return;
    }

    const student = searchableStudents.find((item) => (
      normalizeUsername(item.lichessUsername ?? "") === query ||
      normalizeUsername(item.slug) === query
    ));

    if (!student) {
      setMessage("No student profile matched that Lichess username yet.");
      return;
    }

    setMessage("");
    grantParentStudentProfileAccess(student.slug);
    router.push(`/app/students/${student.slug}`);
  }

  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase text-cyan-100">Parent profile lookup</p>
      <h2 className="mt-1 font-black text-white">View A Student Without Logging In</h2>
      <p className="mt-2 text-sm text-slate-400">
        Enter the student&apos;s Lichess username or profile slug to open only their public academy progress page.
      </p>
      <form onSubmit={openStudentProfile} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/60"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            if (message) setMessage("");
          }}
          placeholder="Lichess username or profile slug"
        />
        <Button type="submit" variant="secondary" disabled={!loaded && !initialStudents?.length}>
          View Student
        </Button>
      </form>
      {message && <p className="mt-3 text-sm text-amber-100">{message}</p>}
    </Card>
  );
}
