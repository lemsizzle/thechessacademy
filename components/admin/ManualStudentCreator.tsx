"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type CreateAdminStudentInput = {
  displayName: string;
  classGroup?: string;
  username: string;
  password: string;
  lichessUsername?: string;
  actionToken?: string;
};

export type CreateAdminStudentResult = {
  ok: boolean;
  studentId?: string;
  username?: string;
  error?: string;
};

export function ManualStudentCreator({
  actionToken,
  createStudentAction
}: {
  actionToken?: string;
  createStudentAction: (input: CreateAdminStudentInput) => Promise<CreateAdminStudentResult>;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<{ id: string; username: string } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [classGroup, setClassGroup] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [lichessUsername, setLichessUsername] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const values = crypto.getRandomValues(new Uint32Array(12));
    setPassword(Array.from(values, (value) => alphabet[value % alphabet.length]).join(""));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("Creating student...");

    try {
      const result = await createStudentAction({
        displayName,
        classGroup,
        username,
        password,
        lichessUsername,
        actionToken
      });

      if (!result.ok) {
        setMessage(result.error ?? "Could not create student.");
        return;
      }

      setMessage(`Created! Login: ${result.username}`);
      setCreated({ id: result.studentId!, username: result.username! });
      setDisplayName("");
      setClassGroup("");
      setUsername("");
      setPassword("");
      setLichessUsername("");
      router.replace(`/admin/students?student=${encodeURIComponent(result.studentId!)}`, { scroll: false });
      router.refresh();
    } catch {
      setMessage("Could not create student.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-cyan-200">Teacher tool</p>
          <h2 className="mt-1 text-xl font-black text-white">Create Student Login</h2>
          <p className="mt-1 text-sm text-slate-400">
            Add a student without requiring a Lichess account. They can link Lichess later.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2">
        <input
          aria-label="Student display name" maxLength={80} disabled={saving}
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Student display name"
          className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-white"
        />

        <input
          aria-label="Class group" maxLength={80} disabled={saving}
          value={classGroup}
          onChange={(event) => setClassGroup(event.target.value)}
          placeholder="Class group (optional)"
          className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-white"
        />

        <input
          aria-label="Academy username" autoComplete="off" autoCapitalize="none" spellCheck={false} pattern="[a-z0-9_-]{3,24}" disabled={saving}
          required
          minLength={3}
          maxLength={24}
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          placeholder="Academy username"
          className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-white"
        />

        <div className="flex gap-2">
          <input
            aria-label="Temporary password" type="text" autoComplete="new-password" maxLength={256} disabled={saving}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Temporary password"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-white"
          />
          <Button type="button" onClick={generatePassword} disabled={saving}>Generate password</Button>
        </div>

        <input
          aria-label="Optional Lichess username" autoCapitalize="none" spellCheck={false} maxLength={30} disabled={saving}
          value={lichessUsername}
          onChange={(event) => setLichessUsername(event.target.value)}
          placeholder="Lichess username (optional)"
          className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-white md:col-span-2"
        />

        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Student"}
          </Button>
          <p role="status" className="text-sm text-slate-300">{message}</p>
        </div>
      </form>
      <p className="mt-3 text-xs text-slate-400">Give the student their password before creating the login. It is cleared after creation and cannot be retrieved.</p>
      {created && <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-4"><p className="font-bold text-emerald-100">Academy username: {created.username}</p><Button className="mt-2" href={`/admin/students?student=${created.id}`} variant="secondary">View created student</Button></div>}
    </Card>
  );
}
