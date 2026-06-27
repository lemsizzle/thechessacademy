"use client";

import { Button } from "@/components/Button";
import { useEffect, useMemo, useState } from "react";

const mockUsers = ["arina", "leo", "sophia", "new-lichess-student"];
type LichessStatus = {
  configured: boolean;
  willOpenLichess: boolean;
  clientId: string;
  callbackUrl: string;
  missing: string[];
};

export function LichessLoginButton() {
  const [mockUsername, setMockUsername] = useState(mockUsers[0]);
  const mockHref = useMemo(() => `/api/auth/lichess/start?mock=${encodeURIComponent(mockUsername)}`, [mockUsername]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<LichessStatus | null>(null);

  useEffect(() => {
    fetch("/api/auth/lichess/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: LichessStatus) => setStatus(data))
      .catch(() => setStatus({ configured: false, willOpenLichess: true, clientId: "the-chess-academy-quest-board-local", callbackUrl: "/api/auth/lichess/callback", missing: ["LICHESS_CLIENT_ID"] }));
  }, []);

  function startLogin(href: string) {
    setLoading(true);
    window.location.assign(href);
  }

  return (
    <div className="space-y-4">
      <Button className="w-full" disabled={loading} onClick={() => startLogin("/api/auth/lichess/start")}>
        {loading ? "Opening Lichess..." : "Log in with Lichess"}
      </Button>
      {status?.configured === false && (
        <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-50">
          <p className="font-bold">Real Lichess will open, but OAuth is using local defaults.</p>
          <p className="mt-1 text-xs text-amber-50/80">For a polished production log in, add these to `.env.local`, then restart the app: {status.missing.join(", ")}.</p>
          <p className="mt-1 text-xs text-amber-50/80">Client ID: {status.clientId}</p>
          <p className="mt-1 text-xs text-amber-50/80">Callback URL: {status.callbackUrl}</p>
        </div>
      )}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs font-bold uppercase text-slate-400">Local mock fallback</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={mockUsername} onChange={(event) => setMockUsername(event.target.value)}>
            {mockUsers.map((username) => <option key={username} value={username}>{username}</option>)}
          </select>
          <Button disabled={loading} onClick={() => startLogin(mockHref)} variant="secondary">Mock Lichess Log In</Button>
        </div>
      </div>
    </div>
  );
}
