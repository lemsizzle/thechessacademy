"use client";

import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { getDefaultEquippedItems, seedAvatarItems } from "@/lib/avatar/catalog";
import type { AvatarItem, StudentAvatarConfig, StudentWallet } from "@/lib/types";
import { getLevelFromXp, getLevelTitleFromXp } from "@/lib/xp";
import { useEffect, useState } from "react";

type AvatarPayload = {
  items: AvatarItem[];
  avatar: StudentAvatarConfig;
  wallet: StudentWallet;
  error?: string;
};

export function StudentDashboardAvatar({ studentId, studentName, lifetimeXp }: { studentId: string; studentName: string; lifetimeXp: number }) {
  const [payload, setPayload] = useState<AvatarPayload | null>(null);
  const [error, setError] = useState("");
  const level = getLevelFromXp(lifetimeXp);
  const rank = getLevelTitleFromXp(lifetimeXp).name;
  const avatarItems = payload?.items ?? seedAvatarItems;
  const avatar = payload?.avatar ?? { studentId, equippedItems: getDefaultEquippedItems(avatarItems) };

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/student/avatar", { cache: "no-store", credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as AvatarPayload;
        if (!response.ok || data.error) throw new Error(data.error ?? "Could not load avatar.");
        setPayload(data);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Could not load avatar.");
      });
    return () => controller.abort();
  }, []);

  return (
    <Card className="overflow-hidden p-5 sm:p-6">
      <div className="grid items-center gap-6 lg:grid-cols-[320px_1fr]">
        <div className="mx-auto">
          <AvatarRenderer items={avatarItems} avatar={avatar} size="studio" label={`${studentName}'s avatar`} />
        </div>
        <div className="text-center lg:text-left">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">My Academy Avatar</p>
          <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">{studentName}</h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
            <span className="rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-sm font-black text-amber-100">Level {level}</span>
            <span className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-sm font-black text-cyan-100">{rank}</span>
            {payload && <span className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-bold text-slate-200">{payload.wallet.academyCoins.toLocaleString()} coins</span>}
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">Your equipped look appears on the leaderboard beside your name.</p>
          {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Button href="/student/avatar">Open Avatar & Store</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
