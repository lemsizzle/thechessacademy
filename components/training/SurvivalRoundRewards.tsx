"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import type { SurvivalRoundBadge, SurvivalRoundRewards as RoundRewards } from "@/lib/puzzle-training/roundRewards";

export function SurvivalRoundRewards({ sessionId }: { sessionId: string }) {
  const [rewards, setRewards] = useState<RoundRewards | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setRewards(null);
    setError("");
    async function load() {
      try {
        const response = await fetch(`/api/student/puzzle-training/rewards?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: "no-store", signal: controller.signal
        });
        if (!response.ok) throw new Error("Rewards unavailable");
        const result = await response.json() as RoundRewards;
        if (active) setRewards(result);
      } catch {
        if (active) setError("Your rewards couldn’t be loaded. Your saved progress is safe.");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [sessionId, attempt]);

  if (error) return (
    <div className="mt-6 rounded-xl border border-white/15 p-4">
      <p role="alert" className="mb-3 text-sm text-slate-300">{error}</p>
      <Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Retry rewards</Button>
    </div>
  );
  if (!rewards) return <p role="status" className="mt-6 text-sm text-slate-300">Loading your round rewards…</p>;
  return <SurvivalRoundRewardsView rewards={rewards} />;
}

export function SurvivalRoundRewardsView({ rewards }: { rewards: RoundRewards }) {
  return (
    <section aria-label="Round rewards" className="mt-6 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/10 to-cyan-300/5 p-4 sm:p-6">
      <h3 className="text-lg font-black text-white">Round rewards</h3>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-950/60 p-4">
          <dt className="text-sm font-bold text-cyan-200">XP earned</dt>
          <dd className="mt-1 text-3xl font-black tabular-nums text-white">+{rewards.xp.toLocaleString()}</dd>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-4">
          <dt className="text-sm font-bold text-amber-200">Coins earned</dt>
          <dd className="mt-1 text-3xl font-black tabular-nums text-white">+{(rewards.puzzleCoins + rewards.badgeCoins).toLocaleString()}</dd>
        </div>
      </dl>
      {rewards.badgeCoins > 0 && <p className="mt-3 text-sm text-amber-100">Includes {rewards.badgeCoins.toLocaleString()} bonus coins from badges.</p>}
      {rewards.badges.length ? (
        <>
          <h4 className="mt-6 font-black text-amber-100">New badges earned</h4>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rewards.badges.map(badge => <EarnedBadge key={badge.badgeId} badge={badge} />)}
          </ul>
        </>
      ) : <p className="mt-4 text-sm text-slate-300">No new badges this round.</p>}
    </section>
  );
}

function EarnedBadge({ badge }: { badge: SurvivalRoundBadge }) {
  const [imageFailed, setImageFailed] = useState(false);
  const tier = ({ C: "Bronze", B: "Silver", A: "Gold", S: "Platinum" } as Record<string, string>)[badge.tier] ?? badge.tier;
  const fallback = `/mock-badge-art/${tier.toLowerCase()}-1.svg?${new URLSearchParams({ badge: badge.name, category: badge.category })}`;
  return (
    <li className="min-w-0 rounded-xl border border-white/15 bg-slate-950/60 p-3 text-center">
      <Image src={imageFailed ? fallback : badge.imageUrl || fallback} alt={`${badge.name} badge artwork`}
        width={192} height={192} unoptimized onError={() => setImageFailed(true)}
        className="mx-auto aspect-square w-full max-w-48 rounded-full object-contain" />
      <p className="mt-3 break-words font-black text-white">{badge.name}</p>
      <p className="mt-1 text-sm text-amber-200">{tier}{badge.coins > 0 ? ` · +${badge.coins} coins` : ""}</p>
    </li>
  );
}
