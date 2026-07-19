"use client";

import { Button } from "@/components/Button";
import { avatarCategoryLabels } from "@/lib/avatar/catalog";
import type { AvatarItem, Student, StudentWallet } from "@/lib/types";
import { useEffect, useState } from "react";

export function AdminStudentAvatarRewards({
  student,
  items,
  adminActionToken
}: {
  student: Student;
  items: AvatarItem[];
  adminActionToken?: string;
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [coinAmount, setCoinAmount] = useState(25);
  const [wallet, setWallet] = useState<StudentWallet | null>(null);
  const [message, setMessage] = useState("Choose a cosmetic to grant, or update this student's spendable coins.");
  const [submitting, setSubmitting] = useState<"grant" | "coins" | null>(null);
  const adminHeaders = {
    "Content-Type": "application/json",
    ...(adminActionToken ? { "x-admin-action-token": adminActionToken } : {})
  };

  useEffect(() => {
    let cancelled = false;
    setWallet(null);
    fetch(`/api/admin/wallets/adjust?studentId=${encodeURIComponent(student.id)}`, {
      cache: "no-store",
      credentials: "include",
      headers: adminActionToken ? { "x-admin-action-token": adminActionToken } : {}
    })
      .then(async (response) => ({ response, data: await response.json() as { wallet?: StudentWallet; error?: string } }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok || !data.wallet) throw new Error(data.error ?? "Could not load Academy Coins.");
        setWallet(data.wallet);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not load Academy Coins.");
      });
    return () => { cancelled = true; };
  }, [adminActionToken, student.id]);

  async function grantItem() {
    if (!itemId || submitting) return;
    setSubmitting("grant");
    setMessage(`Granting an avatar item to ${student.name}...`);

    try {
      const response = await fetch("/api/admin/avatar-items/grant", {
        method: "POST",
        headers: adminHeaders,
        credentials: "include",
        body: JSON.stringify({ studentId: student.id, itemId })
      });
      const data = await response.json() as { message?: string; error?: string };
      setMessage(response.ok ? data.message ?? "Avatar item granted." : data.error ?? "Could not grant avatar item.");
    } catch {
      setMessage("Could not grant the avatar item. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  async function adjustCoins(direction: 1 | -1) {
    if (!coinAmount || submitting) return;
    const amount = Math.abs(coinAmount) * direction;
    setSubmitting("coins");
    setMessage(`${direction > 0 ? "Giving" : "Taking"} ${Math.abs(amount).toLocaleString()} Academy Coins...`);

    try {
      const response = await fetch("/api/admin/wallets/adjust", {
        method: "POST",
        headers: adminHeaders,
        credentials: "include",
        body: JSON.stringify({
          studentId: student.id,
          amount,
          description: `Teacher ${direction > 0 ? "award" : "deduction"} for ${student.name}`
        })
      });
      const data = await response.json() as { wallet?: StudentWallet; error?: string };
      if (!response.ok || !data.wallet) throw new Error(data.error ?? "Could not update Academy Coins.");
      setWallet(data.wallet);
      setMessage(`${student.name} now has ${data.wallet.academyCoins.toLocaleString()} Academy Coins.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update Academy Coins. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/10 p-4">
      <h3 className="font-black text-white">Avatar Rewards & Academy Coins</h3>
      <p className="mt-1 text-sm text-fuchsia-50/80">Changes apply only to {student.name}. Lifetime XP is never spent or changed here.</p>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-3">
        <div>
          <p className="text-xs font-black uppercase text-amber-100/70">Current Balance</p>
          <p className="mt-1 text-2xl font-black text-white">
            {wallet ? wallet.academyCoins.toLocaleString() : "..."} <span className="text-sm text-amber-100">Academy Coins</span>
          </p>
        </div>
        {wallet && (
          <p className="text-xs text-amber-100/70">
            {wallet.totalCoinsEarned.toLocaleString()} earned - {wallet.totalCoinsSpent.toLocaleString()} spent
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="grid gap-2 rounded-md border border-white/10 bg-black/20 p-3">
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
            Cosmetic To Grant
            <select
              className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white"
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              disabled={!items.length || Boolean(submitting)}
            >
              {!items.length && <option value="">No cosmetics available</option>}
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {avatarCategoryLabels[item.category]}{item.isActive ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" onClick={grantItem} disabled={!itemId || Boolean(submitting)}>
            {submitting === "grant" ? "Granting..." : "Grant Item"}
          </Button>
        </div>

        <div className="grid gap-2 rounded-md border border-white/10 bg-black/20 p-3">
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
            Coins To Give Or Take
            <input
              className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white"
              type="number"
              step="1"
              min="1"
              value={coinAmount}
              onChange={(event) => setCoinAmount(Math.max(0, Math.trunc(Number(event.target.value)) || 0))}
              disabled={Boolean(submitting)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => adjustCoins(1)} disabled={!coinAmount || Boolean(submitting)}>
              {submitting === "coins" ? "Updating..." : "Give Coins"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => adjustCoins(-1)}
              disabled={!coinAmount || Boolean(submitting) || !wallet || coinAmount > wallet.academyCoins}
            >
              Take Coins
            </Button>
          </div>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 text-xs font-bold text-fuchsia-50/80">{message}</p>
    </div>
  );
}
