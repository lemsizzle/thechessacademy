"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LichessLoginButton } from "@/components/student/LichessLoginButton";
import { useState } from "react";

export function StudentLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitAcademyLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("Logging in...");

    try {
      const response = await fetch("/api/auth/student/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Invalid username or password.");
        return;
      }

      window.location.href = "/student";
    } catch {
      setMessage("Login could not be reached. Try again.");
    } finally {
      setPassword("");
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-lg p-5">
      <h2 className="font-black text-white">Student Log In</h2>
      <p className="mt-2 text-sm text-slate-300">
        Use your Chess Academy login, or continue with Lichess.
      </p>

      <form onSubmit={submitAcademyLogin} className="mt-5 space-y-3">
        <label htmlFor="student-username" className="block text-sm font-bold text-slate-200">Academy username</label>
        <input
          id="student-username"
          maxLength={24} autoCapitalize="none" spellCheck={false}
          autoComplete="username"
          required
          className="w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-white"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Academy username"
        />

        <label htmlFor="student-password" className="block text-sm font-bold text-slate-200">Password</label>
        <input
          id="student-password"
          maxLength={256}
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-white"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
        />

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </Button>
      </form>

      {message ? <p role="status" className="mt-3 text-sm text-slate-300">{message}</p> : null}

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs font-bold uppercase text-slate-500">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <LichessLoginButton />
      <p className="mt-3 text-xs text-slate-500">
        Lichess handles its own password. The Chess Academy never receives it.
      </p>
    </Card>
  );
}
