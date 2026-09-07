"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { grantParentStudentProfileAccess } from "@/lib/publicStudentAccess";
import { lookupPublicStudent } from "@/app/actions/studentProfileLookup";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

function normalizeUsername(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function ParentStudentLookup() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  async function openStudentProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const query = normalizeUsername(username);
    if (!query) {
      setMessage("Enter the student's Lichess username.");
      return;
    }

    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await lookupPublicStudent(query);
      if (!result.slug) { setMessage(result.error ?? "Student not found."); return; }
      grantParentStudentProfileAccess(result.slug);
      router.push(`/app/students/${encodeURIComponent(result.slug)}`);
    } catch { setMessage("Profile lookup is temporarily unavailable. Please try again."); }
    finally { busy.current = false; setPending(false); }
  }

  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase text-cyan-100">Parent profile lookup</p>
      <h2 className="mt-1 font-black text-white">View A Student Without Logging In</h2>
      <p className="mt-2 text-sm text-slate-400">
        Enter the student&apos;s Lichess username or profile slug to open only their public academy progress page.
      </p>
      <form onSubmit={openStudentProfile} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label htmlFor="parent-student-lookup" className="sr-only">Lichess username or profile slug</label>
        <input
          id="parent-student-lookup"
          name="student"
          maxLength={100}
          autoComplete="username"
          className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/60"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            if (message) setMessage("");
          }}
          placeholder="Lichess username or profile slug"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Finding student…" : "View Student"}
        </Button>
      </form>
      {message && <p role="status" className="mt-3 text-sm text-amber-100">{message}</p>}
    </Card>
  );
}
