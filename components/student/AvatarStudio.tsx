"use client";

import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { avatarCategories, avatarCategoryLabels, avatarRarityStyles } from "@/lib/avatar/catalog";
import type { AvatarCategory, AvatarItem, StudentAvatarConfig, StudentInventoryItem, StudentWallet } from "@/lib/types";
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

export function AvatarStudio() {
  const [state, setState] = useState<AvatarPayload | null>(null);
  const [category, setCategory] = useState<AvatarCategory>("headwear");
  const [previewItem, setPreviewItem] = useState<AvatarItem | null>(null);
  const [equipped, setEquipped] = useState<Partial<Record<AvatarCategory, string>>>({});
  const [message, setMessage] = useState("Loading Avatar Studio...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/student/avatar", { cache: "no-store", credentials: "include" })
      .then((response) => response.json())
      .then((data: AvatarPayload) => {
        if (data.error) throw new Error(data.error);
        setState(data);
        setEquipped(data.avatar.equippedItems);
        setMessage("Choose owned items to equip. Locked items can be previewed first.");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load avatar."));
  }, []);

  const owned = useMemo(() => new Set(state?.ownedItemIds ?? []), [state?.ownedItemIds]);
  const categoryItems = useMemo(() => (state?.items ?? []).filter((item) => item.category === category), [category, state?.items]);
  const renderAvatar = state ? { ...state.avatar, equippedItems: equipped } : { studentId: "loading", equippedItems: {} };

  async function saveAvatar(nextEquipped = equipped) {
    setSaving(true);
    setMessage("Saving avatar...");
    try {
      const response = await fetch("/api/student/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ equippedItems: nextEquipped })
      });
      const data = await response.json() as AvatarPayload;
      if (!response.ok || data.error) throw new Error(data.error ?? "Could not save avatar.");
      setState(data);
      setEquipped(data.avatar.equippedItems);
      setPreviewItem(null);
      setMessage(data.message ?? "Avatar saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save avatar.");
    } finally {
      setSaving(false);
    }
  }

  function equip(item: AvatarItem) {
    if (!owned.has(item.id)) {
      setPreviewItem(item);
      setMessage("Previewing locked item. Purchase it in the Academy Armory before equipping.");
      return;
    }
    const next = { ...equipped, [item.category]: item.id };
    setEquipped(next);
    setPreviewItem(null);
    void saveAvatar(next);
  }

  function unequip(slot: AvatarCategory) {
    const next = { ...equipped };
    delete next[slot];
    setEquipped(next);
    setPreviewItem(null);
    void saveAvatar(next);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <Card className="p-5">
        <div className="flex flex-col items-center gap-4">
          {state && <AvatarRenderer items={state.items} avatar={renderAvatar} previewItem={previewItem} size="studio" label="Live avatar preview" />}
          <div className="w-full rounded-lg border border-amber-200/20 bg-amber-300/10 p-3 text-center">
            <p className="text-xs font-black uppercase text-amber-100">Academy Coins</p>
            <p className="text-3xl font-black text-white">{state?.wallet.academyCoins.toLocaleString() ?? "..."}</p>
          </div>
          <Button className="w-full" onClick={() => saveAvatar()} disabled={!state || saving}>Save Avatar</Button>
          <Button href="/student/armory" className="w-full" variant="secondary">Open Academy Armory</Button>
          <p className="text-sm text-slate-300">{message}</p>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap gap-2">
          {avatarCategories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`rounded-md border px-3 py-2 text-xs font-black uppercase transition active:translate-y-px ${category === item.id ? "border-cyan-200 bg-cyan-300/20 text-cyan-50" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categoryItems.map((item) => {
            const itemOwned = owned.has(item.id);
            const itemEquipped = equipped[item.category] === item.id;
            return (
              <div key={item.id} className={`rounded-lg border p-3 ${itemEquipped ? "border-amber-200/60 bg-amber-300/10" : "border-white/10 bg-slate-950/60"}`}>
                <div className="flex items-center gap-3">
                  <AvatarRenderer items={[item]} avatar={{ studentId: "preview", equippedItems: { [item.category]: item.id } }} size="sm" label={`${item.name} preview`} />
                  <div className="min-w-0">
                    <p className="font-black text-white">{item.name}</p>
                    <p className="text-xs text-slate-400">{avatarCategoryLabels[item.category]}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-300">{item.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className={`rounded border px-2 py-1 ${avatarRarityStyles[item.rarity]}`}>{item.rarity}</span>
                  <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-200">{itemOwned ? "Owned" : item.unlockType === "purchase" ? `${item.price} coins` : "Achievement-only"}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1 px-3 py-2" variant={itemOwned ? "primary" : "secondary"} onClick={() => equip(item)}>{itemOwned ? itemEquipped ? "Equipped" : "Equip" : "Preview"}</Button>
                  {itemEquipped && <Button className="px-3 py-2" variant="ghost" onClick={() => unequip(item.category)}>Unequip</Button>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
