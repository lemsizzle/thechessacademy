"use client";

import { Button } from "@/components/Button";
import { avatarCategoryLabels } from "@/lib/avatar/catalog";
import type { AvatarItem, Student } from "@/lib/types";
import { useState } from "react";

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
  const [message, setMessage] = useState("Choose a cosmetic to grant, or adjust this student's spendable coins.");
  const [submitting, setSubmitting] = useState<"grant" | "coins" | null>(null);
  const adminHeaders = {
    "Content-Type": "application/json",
    ...(adminActionToken ? { "x-admin-action-token": adminActionToken } : {})
  };

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

  async function adjustCoins() {
    if (!coinAmount || submitting) return;
    setSubmitting("coins");
    setMessage(`Updating ${student.name}'s Academy Coins...`);

    try {
      const response = await fetch("/api/admin/wallets/adjust", {
        method: "POST",
        headers: adminHeaders,
        credentials: "include",
        body: JSON.stringify({
          studentId: student.id,
          amount: coinAmount,
          description: `Teacher adjustment for ${student.name}`
        })
      });
      const data = await response.json() as { message?: string; error?: string };
      setMessage(response.ok ? data.message ?? "Academy Coins updated." : data.error ?? "Could not update Academy Coins.");
    } catch {
      setMessage("Could not update Academy Coins. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/10 p-4">
      <h3 className="font-black text-white">Avatar Rewards & Academy Coins</h3>
      <p className="mt-1 text-sm text-fuchsia-50/80">Changes apply only to {student.name}. Lifetime XP is never spent or changed here.</p>
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
                  {item.name} — {avatarCategoryLabels[item.category]}{item.isActive ? "" : " (inactive)"}
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
            Coin Adjustment
            <input
              className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white"
              type="number"
              step="1"
              value={coinAmount}
              onChange={(event) => setCoinAmount(Math.trunc(Number(event.target.value)) || 0)}
              disabled={Boolean(submitting)}
            />
          </label>
          <Button onClick={adjustCoins} disabled={!coinAmount || Boolean(submitting)}>
            {submitting === "coins" ? "Updating..." : coinAmount < 0 ? "Remove Coins" : "Add Coins"}
          </Button>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 text-xs font-bold text-fuchsia-50/80">{message}</p>
    </div>
  );
}
