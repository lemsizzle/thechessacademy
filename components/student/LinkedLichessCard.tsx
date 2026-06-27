"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LichessXpSummary } from "@/components/lichess/LichessXpSummary";
import type { StudentLichessAccount } from "@/lib/types";

export function LinkedLichessCard({ account, showXpSummary = false }: { account?: StudentLichessAccount; showXpSummary?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-slate-400">Linked Lichess</p>
          <h2 className="mt-1 font-black text-white">{account?.lichessUsername ?? "Connected by session"}</h2>
          <p className="mt-1 text-sm text-slate-400">Only puzzles, rated games, and Arena points earned after first login are counted. Provisional ratings do not add rating XP, but rated games still count.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {account?.lichessProfileUrl && <Button href={account.lichessProfileUrl} target="_blank" rel="noreferrer" variant="ghost">Open Lichess</Button>}
          <Button href="/student/lichess-progress" variant="secondary">Lichess Progress</Button>
        </div>
      </div>
      {account && showXpSummary && <div className="mt-3"><LichessXpSummary account={account} /></div>}
    </Card>
  );
}
