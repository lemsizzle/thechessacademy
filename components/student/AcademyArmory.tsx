"use client";

import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { avatarCategories, avatarCategoryLabels, avatarRarities, avatarRarityStyles } from "@/lib/avatar/catalog";
import type { AvatarCategory, AvatarItem, AvatarRarity, StudentAvatarConfig, StudentInventoryItem, StudentWallet } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type AvatarPayload = {
  items: AvatarItem[];
  inventory: StudentInventoryItem[];
  ownedItemIds: string[];
  wallet: StudentWallet;
  avatar: StudentAvatarConfig;
  message?: string;
  error?: string;
};

export function AcademyArmory() {
  const [state, setState] = useState<AvatarPayload | null>(null);
  const [category, setCategory] = useState<"all" | AvatarCategory>("all");
  const [rarity, setRarity] = useState<"all" | AvatarRarity>("all");
  const [ownedFilter, setOwnedFilter] = useState<"all" | "owned" | "locked" | "affordable">("all");
  const [message, setMessage] = useState("Loading Academy Armory...");
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  function load() {
    fetch("/api/student/avatar", { cache: "no-store", credentials: "include" })
      .then((response) => response.json())
      .then((data: AvatarPayload) => {
        if (data.error) throw new Error(data.error);
        setState(data);
        setMessage("Preview gear, buy purchasable items, and equip them in Avatar Studio.");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load armory."));
  }

  useEffect(load, []);

  const owned = useMemo(() => new Set(state?.ownedItemIds ?? []), [state?.ownedItemIds]);
  const filtered = useMemo(() => (state?.items ?? []).filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (rarity !== "all" && item.rarity !== rarity) return false;
    if (ownedFilter === "owned" && !owned.has(item.id)) return false;
    if (ownedFilter === "locked" && owned.has(item.id)) return false;
    if (ownedFilter === "affordable" && (owned.has(item.id) || item.unlockType !== "purchase" || item.price > (state?.wallet.academyCoins ?? 0))) return false;
    return true;
  }), [category, owned, ownedFilter, rarity, state?.items, state?.wallet.academyCoins]);

  async function purchase(item: AvatarItem) {
    setBusyItemId(item.id);
    setMessage(`Purchasing ${item.name}...`);
    try {
      const response = await fetch("/api/student/avatar/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemId: item.id })
      });
      const data = await response.json() as AvatarPayload;
      if (!response.ok || data.error) throw new Error(data.error ?? "Purchase failed.");
      setState(data);
      setMessage(data.message ?? `${item.name} purchased.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase failed.");
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-amber-100">Academy Coins</p>
            <p className="text-4xl font-black text-white">{state?.wallet.academyCoins.toLocaleString() ?? "..."}</p>
            <p className="mt-1 text-sm text-slate-300">{message}</p>
          </div>
          <Button href="/student/avatar" variant="secondary">Open Avatar Studio</Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Category
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={category} onChange={(event) => setCategory(event.target.value as "all" | AvatarCategory)}>
              <option value="all">All categories</option>
              {avatarCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Rarity
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={rarity} onChange={(event) => setRarity(event.target.value as "all" | AvatarRarity)}>
              <option value="all">All rarities</option>
              {avatarRarities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Filter
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={ownedFilter} onChange={(event) => setOwnedFilter(event.target.value as typeof ownedFilter)}>
              <option value="all">All items</option>
              <option value="owned">Owned</option>
              <option value="locked">Locked</option>
              <option value="affordable">Affordable</option>
            </select>
          </label>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => {
          const itemOwned = owned.has(item.id);
          const equipped = state?.avatar.equippedItems[item.category] === item.id;
          const canBuy = item.unlockType === "purchase" && !itemOwned;
          const affordable = (state?.wallet.academyCoins ?? 0) >= item.price;
          return (
            <Card key={item.id} className={`p-4 ${item.isFeatured ? "border-amber-200/40" : ""}`}>
              <div className="flex items-start gap-3">
                <AvatarRenderer items={[item]} avatar={{ studentId: "preview", equippedItems: { [item.category]: item.id } }} size="lg" label={`${item.name} preview`} />
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white">{item.name}</p>
                  <p className="text-sm text-slate-400">{avatarCategoryLabels[item.category]}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className={`rounded border px-2 py-1 ${avatarRarityStyles[item.rarity]}`}>{item.rarity}</span>
                    <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-200">{itemOwned ? "Owned" : item.unlockType === "purchase" ? `${item.price} coins` : "Achievement-only"}</span>
                    {equipped && <span className="rounded border border-amber-200/40 bg-amber-300/10 px-2 py-1 text-amber-100">Equipped</span>}
                  </div>
                  {item.unlockRequirement && <p className="mt-2 text-xs text-slate-500">{item.unlockRequirement}</p>}
                  <Button
                    className="mt-4 w-full"
                    variant={canBuy && affordable ? "primary" : "secondary"}
                    disabled={!canBuy || !affordable || busyItemId === item.id}
                    onClick={() => purchase(item)}
                  >
                    {itemOwned ? "Owned" : item.unlockType !== "purchase" ? "Achievement Item" : affordable ? "Purchase" : "Need More Coins"}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
