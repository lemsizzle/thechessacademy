"use client";
import { useState } from "react";
import { Button } from "@/components/Button";

export function EmailAuthForm({ register = false }: { register?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/email", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: register ? "register" : "login", email, password, nickname }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Please try again."); return; }
      if (result.ok) { window.location.assign("/student"); return; }
      setSent(true); setMessage(result.message);
    } catch { setMessage("We couldn’t connect. Please try again."); }
    finally { setPassword(""); setBusy(false); }
  }
  const inputClass = "mt-2 w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-3 text-base text-white";
  return <div>
    {sent ? <div className="rounded-lg border border-cyan-200/30 bg-cyan-200/5 p-4">
      <h2 className="font-bold text-white">Check your inbox</h2>
      <p className="mt-2 text-sm text-slate-300">{message}</p>
      <a className="mt-4 inline-block font-bold text-cyan-200 underline" href="/login?method=email">Return to email login</a>
    </div> : <form onSubmit={submit} className="space-y-4">
      {register && <label className="block text-sm font-bold text-slate-200">Chess nickname
        <input className={inputClass} autoComplete="nickname" required maxLength={40} value={nickname} onChange={e => setNickname(e.target.value)} disabled={busy} />
        <span className="mt-1 block text-xs font-normal text-slate-400">Shown on your profile. Choose a nickname, not your full name.</span>
      </label>}
      <label className="block text-sm font-bold text-slate-200">Email
        <input className={inputClass} type="email" autoComplete="email" autoCapitalize="none" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
      </label>
      <label className="block text-sm font-bold text-slate-200">Password
        <input className={inputClass} type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 8 : undefined} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
        {register && <span className="mt-1 block text-xs font-normal text-slate-400">At least 8 characters.</span>}
      </label>
      <Button className="w-full" disabled={busy} type="submit">{busy ? "Please wait…" : register ? "Register with email" : "Log in with email"}</Button>
      {message && <p role="status" className="text-sm text-amber-100">{message}</p>}
    </form>}
  </div>;
}
