"use client";

import { Card } from "@/components/Card";
import { useEffect, useState } from "react";

export function StudentCoinsBalanceCard() {
  const [coins, setCoins] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/avatar", { cache: "no-store", credentials: "include" })
      .then((response) => response.json())
      .then((data: { wallet?: { academyCoins?: number } }) => {
        if (!cancelled) setCoins(Number(data.wallet?.academyCoins ?? 0));
      })
      .catch(() => {
        if (!cancelled) setCoins(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-amber-100">Academy Coins</p>
          <p className="mt-1 text-3xl font-black text-white">{coins === null ? "..." : coins.toLocaleString()}</p>
          <p className="mt-1 text-sm text-slate-400">Coins are earned with XP. Spending coins never lowers lifetime XP.</p>
        </div>
        <div className="flex gap-2">
          <a className="rounded-md border border-sky-300/40 bg-sky-300/10 px-3 py-2 text-sm font-bold text-sky-50 hover:bg-sky-300/20" href="/student/avatar">Avatar Studio</a>
          <a className="rounded-md border border-amber-300/50 bg-amber-300 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-200" href="/student/armory">Armory</a>
        </div>
      </div>
    </Card>
  );
}
