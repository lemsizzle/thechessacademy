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

type CollectionFilter = "all" | "owned" | "locked" | "affordable";

export function AvatarStudio() {
  const [state, setState] = useState<AvatarPayload | null>(null);
  const [category, setCategory] = useState<"all" | AvatarCategory>("all");
  const [rarity, setRarity] = useState<"all" | AvatarRarity>("all");
  const [collection, setCollection] = useState<CollectionFilter>("all");
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [equipped, setEquipped] = useState<Partial<Record<AvatarCategory, string>>>({});
  const [message, setMessage] = useState("Loading avatar items...");
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/student/avatar", { cache: "no-store", credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as AvatarPayload;
        if (!response.ok || data.error) throw new Error(data.error ?? "Could not load avatar items.");
        setState(data);
        setEquipped(data.avatar.equippedItems);
        setMessage("Avatar ready.");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "Could not load avatar items.");
      });
    return () => controller.abort();
  }, []);

  const owned = useMemo(() => new Set(state?.ownedItemIds ?? []), [state?.ownedItemIds]);
  const previewItem = useMemo(
    () => (state?.items ?? []).find((item) => item.id === previewItemId) ?? null,
    [previewItemId, state?.items]
  );
  const filteredItems = useMemo(() => (state?.items ?? []).filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (rarity !== "all" && item.rarity !== rarity) return false;
    const itemOwned = owned.has(item.id);
    if (collection === "owned" && !itemOwned) return false;
    if (collection === "locked" && itemOwned) return false;
    if (collection === "affordable" && (itemOwned || item.unlockType !== "purchase" || item.price > (state?.wallet.academyCoins ?? 0))) return false;
    return true;
  }), [category, collection, owned, rarity, state?.items, state?.wallet.academyCoins]);
  const renderAvatar = state ? { ...state.avatar, equippedItems: equipped } : { studentId: "loading", equippedItems: {} };

  async function saveAvatar(nextEquipped: Partial<Record<AvatarCategory, string>>, itemId: string) {
    setBusyItemId(itemId);
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
      setPreviewItemId(null);
      setMessage(data.message ?? "Avatar saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save avatar.");
    } finally {
      setBusyItemId(null);
    }
  }

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
      setEquipped(data.avatar.equippedItems);
      setPreviewItemId(item.id);
      setMessage(`${item.name} purchased. It is ready to equip.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase failed.");
    } finally {
      setBusyItemId(null);
    }
  }

  function equip(item: AvatarItem) {
    if (!owned.has(item.id)) return;
    const next = { ...equipped, [item.category]: item.id };
    setEquipped(next);
    void saveAvatar(next, item.id);
  }

  function unequip(item: AvatarItem) {
    if (item.category === "base_face" || item.category === "skin_tone") return;
    const next = { ...equipped };
    delete next[item.category];
    setEquipped(next);
    void saveAvatar(next, item.id);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="p-5 xl:sticky xl:top-20 xl:self-start">
        <div className="flex flex-col items-center gap-4">
          {state && <AvatarRenderer items={state.items} avatar={renderAvatar} previewItem={previewItem} size="studio" label="Live avatar preview" />}
          <div className="grid w-full grid-cols-2 gap-2">
            <div className="rounded-lg border border-cyan-200/20 bg-cyan-300/10 p-3 text-center">
              <p className="text-xs font-black uppercase text-cyan-100">Owned</p>
              <p className="text-2xl font-black text-white">{state?.ownedItemIds.length ?? "..."}</p>
            </div>
            <div className="rounded-lg border border-amber-200/20 bg-amber-300/10 p-3 text-center">
              <p className="text-xs font-black uppercase text-amber-100">Academy Coins</p>
              <p className="text-2xl font-black text-white">{state?.wallet.academyCoins.toLocaleString() ?? "..."}</p>
            </div>
          </div>
          {previewItem && (
            <div className="w-full rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-white">{previewItem.name}</p>
                  <p className="text-xs text-slate-400">{avatarCategoryLabels[previewItem.category]}</p>
                </div>
                <button type="button" onClick={() => setPreviewItemId(null)} className="rounded-md border border-white/10 px-2 py-1 text-xs font-black text-slate-300 active:translate-y-px" aria-label="Close preview">Close</button>
              </div>
            </div>
          )}
          <p className="w-full text-sm text-slate-300" role="status">{message}</p>
        </div>
      </Card>

      <div className="min-w-0 space-y-4">
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
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
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Collection
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={collection} onChange={(event) => setCollection(event.target.value as CollectionFilter)}>
                <option value="all">All items</option>
                <option value="owned">Owned</option>
                <option value="locked">Locked</option>
                <option value="affordable">Affordable</option>
              </select>
            </label>
          </div>
        </Card>

        {!state ? (
          <Card className="p-6 text-center text-slate-300">Loading avatar collection...</Card>
        ) : filteredItems.length ? (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredItems.map((item) => {
              const itemOwned = owned.has(item.id);
              const itemEquipped = equipped[item.category] === item.id;
              const itemPreviewed = previewItemId === item.id;
              const affordable = (state?.wallet.academyCoins ?? 0) >= item.price;
              const busy = busyItemId === item.id;
              return (
                <Card key={item.id} className={`p-4 ${itemEquipped ? "border-amber-200/60 bg-amber-300/10" : itemPreviewed ? "border-cyan-200/60 bg-cyan-300/10" : item.isFeatured ? "border-purple-300/40" : ""}`}>
                  <div className="flex items-start gap-3">
                    <AvatarRenderer items={[item]} avatar={{ studentId: "preview", equippedItems: { [item.category]: item.id } }} size="lg" label={`${item.name} preview`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-white">{item.name}</p>
                      <p className="text-xs text-slate-400">{avatarCategoryLabels[item.category]}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                        <span className={`rounded border px-2 py-1 ${avatarRarityStyles[item.rarity]}`}>{item.rarity}</span>
                        <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-200">
                          {itemOwned ? "Owned" : item.unlockType === "purchase" ? `${item.price} coins` : "Achievement-only"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{item.description}</p>
                  {item.unlockRequirement && !itemOwned && <p className="mt-2 text-xs text-slate-500">{item.unlockRequirement}</p>}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button variant="secondary" className="px-3 py-2" onClick={() => setPreviewItemId(item.id)}>{itemPreviewed ? "Previewing" : "Preview"}</Button>
                    {itemOwned ? (
                      <Button className="px-3 py-2" disabled={itemEquipped || busy} onClick={() => equip(item)}>{itemEquipped ? "Equipped" : busy ? "Saving..." : "Equip"}</Button>
                    ) : item.unlockType === "purchase" ? (
                      <Button className="px-3 py-2" disabled={!affordable || busy} onClick={() => purchase(item)}>{busy ? "Buying..." : affordable ? `Buy - ${item.price}` : "Need More Coins"}</Button>
                    ) : (
                      <Button className="px-3 py-2" variant="ghost" disabled>Locked</Button>
                    )}
                  </div>
                  {itemEquipped && item.category !== "base_face" && item.category !== "skin_tone" && (
                    <Button className="mt-2 w-full px-3 py-2" variant="ghost" disabled={busy} onClick={() => unequip(item)}>Unequip</Button>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-6 text-center text-slate-300">No avatar items match these filters.</Card>
        )}
      </div>
    </div>
  );
}
