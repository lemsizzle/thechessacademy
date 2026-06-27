"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StudentLoginForm } from "@/components/student/StudentLoginForm";
import { useState } from "react";

type LoginMode = "student" | "admin";

export function LoginHub({ initialMode = "student" }: { initialMode?: LoginMode }) {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Enter the teacher password.");
  const [loading, setLoading] = useState(false);

  async function submitTeacherLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("Checking teacher access...");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (response.ok) {
        const session = await fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" })
          .then((sessionResponse) => sessionResponse.json() as Promise<{ authenticated?: boolean }>)
          .catch(() => ({ authenticated: false }));
        if (session.authenticated) {
          window.localStorage.setItem("quest-board-admin", "true");
          window.location.href = "/admin";
          return;
        }
        setMessage("Teacher password was accepted, but the secure session cookie was not saved. Check Vercel domain and cookie settings.");
        return;
      }
      const data = await response.json().catch(() => ({})) as { error?: string };
      setMessage(data.error ?? "Teacher login failed.");
    } catch {
      setMessage("Teacher login could not be reached. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="academy-grid min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col justify-center">
        <div className="mb-5 text-center">
          <p className="text-xs font-black uppercase text-cyan-100">The Chess Academy Quest Board</p>
          <h1 className="mt-2 text-3xl font-black text-white">Log In</h1>
          <p className="mt-2 text-sm text-slate-400">Choose your path into the academy board.</p>
        </div>

        <div className="mx-auto mb-5 grid w-full max-w-lg grid-cols-2 rounded-lg border border-white/10 bg-slate-950/75 p-1">
          <button
            type="button"
            onClick={() => setMode("student")}
            className={`rounded-md px-3 py-2 text-sm font-black transition active:translate-y-px active:scale-[0.98] ${mode === "student" ? "bg-cyan-300 text-slate-950 shadow-glow" : "text-slate-300 hover:bg-white/10"}`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setMode("admin")}
            className={`rounded-md px-3 py-2 text-sm font-black transition active:translate-y-px active:scale-[0.98] ${mode === "admin" ? "bg-amber-300 text-slate-950 shadow-gold" : "text-slate-300 hover:bg-white/10"}`}
          >
            Teacher
          </button>
        </div>

        {mode === "student" ? (
          <StudentLoginForm />
        ) : (
          <Card className="mx-auto w-full max-w-lg p-5">
            <h2 className="font-black text-white">Teacher Log In</h2>
            <p className="mt-2 text-sm text-slate-400">Teacher access is protected by the server-side ADMIN_PASSWORD setting.</p>
            <form onSubmit={submitTeacherLogin} className="mt-5 space-y-3">
              <input
                className="w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-white"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
              />
              <Button className="w-full" type="submit" disabled={loading}>{loading ? "Checking..." : "Enter Dashboard"}</Button>
            </form>
            <p className="mt-4 text-sm text-slate-300">{message}</p>
          </Card>
        )}
      </div>
    </main>
  );
}
