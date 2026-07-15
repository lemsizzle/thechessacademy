"use client";

import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { avatarCategories, avatarCategoryLabels, avatarRarities, avatarRarityStyles, avatarUnlockTypes, seedAvatarItems } from "@/lib/avatar/catalog";
import { academyCoinEconomy } from "@/lib/avatar/economy";
import type { AvatarCategory, AvatarItem, AvatarRarity, AvatarUnlockType, Student } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type FormState = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  category: AvatarCategory;
  rarity: AvatarRarity;
  price: number;
  assetUrl: string;
  thumbnailUrl: string;
  layerOrder: number;
  unlockType: AvatarUnlockType;
  unlockRequirement: string;
  isActive: boolean;
  isFeatured: boolean;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  category: "headwear",
  rarity: "Common",
  price: 5,
  assetUrl: "",
  thumbnailUrl: "",
  layerOrder: 50,
  unlockType: "purchase",
  unlockRequirement: "",
  isActive: true,
  isFeatured: false
};

function formFromItem(item: AvatarItem): FormState {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    category: item.category,
    rarity: item.rarity,
    price: item.price,
    assetUrl: item.assetUrl ?? "",
    thumbnailUrl: item.thumbnailUrl ?? "",
    layerOrder: item.layerOrder,
    unlockType: item.unlockType,
    unlockRequirement: item.unlockRequirement ?? "",
    isActive: item.isActive,
    isFeatured: item.isFeatured
  };
}

export function AdminAvatarItemsPanel({ students }: { students: Student[] }) {
  const [items, setItems] = useState<AvatarItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [grantItemId, setGrantItemId] = useState("");
  const [coinAmount, setCoinAmount] = useState(100);
  const [message, setMessage] = useState("Loading avatar item manager...");
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId), [items, selectedId]);

  function loadItems() {
    fetch("/api/admin/avatar-items", { cache: "no-store", credentials: "include" })
      .then((response) => response.json())
      .then((data: { items?: AvatarItem[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        const nextItems = data.items?.length ? data.items : seedAvatarItems;
        setItems(nextItems);
        setGrantItemId((current) => current || nextItems[0]?.id || "");
        setMessage("Avatar items loaded.");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load avatar items."));
  }

  useEffect(loadItems, []);

  useEffect(() => {
    if (selectedItem) setForm(formFromItem(selectedItem));
  }, [selectedItem]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveItem() {
    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      category: form.category,
      rarity: form.rarity,
      price: form.price,
      assetUrl: form.assetUrl || null,
      thumbnailUrl: form.thumbnailUrl || form.assetUrl || null,
      layerOrder: form.layerOrder,
      unlockType: form.unlockType,
      unlockRequirement: form.unlockRequirement || null,
      isActive: form.isActive,
      isFeatured: form.isFeatured
    };
    const url = form.id ? `/api/admin/avatar-items/${encodeURIComponent(form.id)}` : "/api/admin/avatar-items";
    const method = form.id ? "PATCH" : "POST";
    setMessage("Saving avatar item...");
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    const data = await response.json() as { item?: AvatarItem; error?: string };
    if (!response.ok || data.error || !data.item) {
      setMessage(data.error ?? "Could not save avatar item.");
      return;
    }
    setItems((current) => {
      const exists = current.some((item) => item.id === data.item!.id);
      return exists ? current.map((item) => item.id === data.item!.id ? data.item! : item) : [data.item!, ...current];
    });
    setSelectedId(data.item.id);
    setMessage("Avatar item saved.");
  }

  async function grantItem() {
    if (!studentId || !grantItemId) return;
    setMessage("Granting avatar item...");
    const response = await fetch("/api/admin/avatar-items/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ studentId, itemId: grantItemId })
    });
    const data = await response.json() as { message?: string; error?: string };
    setMessage(response.ok ? data.message ?? "Avatar item granted." : data.error ?? "Could not grant avatar item.");
  }

  async function adjustCoins() {
    if (!studentId) return;
    setMessage("Updating Academy Coins...");
    const response = await fetch("/api/admin/wallets/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ studentId, amount: coinAmount, description: "Teacher Academy Coins adjustment" })
    });
    const data = await response.json() as { message?: string; error?: string };
    setMessage(response.ok ? data.message ?? "Academy Coins updated." : data.error ?? "Could not update Academy Coins.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <div className="space-y-5">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-white">Item Library</h2>
              <p className="text-sm text-slate-400">{items.length} cosmetics</p>
            </div>
            <Button variant="secondary" onClick={() => { setSelectedId(""); setForm(emptyForm); }}>New Item</Button>
          </div>
          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-md border p-3 text-left transition active:translate-y-px ${selectedId === item.id ? "border-cyan-200 bg-cyan-300/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              >
                <div className="flex items-center gap-3">
                  <AvatarRenderer items={[item]} avatar={{ studentId: "admin", equippedItems: { [item.category]: item.id } }} size="sm" label={`${item.name} preview`} />
                  <div>
                    <p className="font-black text-white">{item.name}</p>
                    <p className="text-xs text-slate-400">{avatarCategoryLabels[item.category]} - {item.isActive ? "Active" : "Inactive"}</p>
                    <p className="mt-1 text-xs font-bold text-amber-100">{item.unlockType === "purchase" ? `${item.price} coins` : "Free / reward item"}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-black text-white">Grant & Coins</h2>
          <p className="mt-1 text-sm text-slate-400">1 XP earns 1 Academy Coin. Coin changes never change lifetime XP.</p>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Student
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name} - {student.lichessUsername ?? student.slug}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Avatar Item
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={grantItemId} onChange={(event) => setGrantItemId(event.target.value)}>
                {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <Button variant="secondary" onClick={grantItem}>Grant Item</Button>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Coin Adjustment
              <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" type="number" value={coinAmount} onChange={(event) => setCoinAmount(Number(event.target.value) || 0)} />
            </label>
            <Button onClick={adjustCoins}>Adjust Coins</Button>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-5 rounded-lg border border-cyan-200/20 bg-cyan-300/10 p-4 text-sm text-cyan-50">
          Select an item from the library, set its unlock type to <strong>purchase</strong>, change its store price, then choose <strong>Save Item</strong>. Price changes take effect in the Academy Armory immediately.
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">{form.id ? "Edit Avatar Item" : "Create Avatar Item"}</h2>
            <p className="mt-1 text-sm text-slate-400">{message}</p>
            <p className="mt-2 text-xs text-slate-500">
              Price guide: Common {academyCoinEconomy.rarityPriceRanges.Common.min}-{academyCoinEconomy.rarityPriceRanges.Common.max},
              Uncommon {academyCoinEconomy.rarityPriceRanges.Uncommon.min}-{academyCoinEconomy.rarityPriceRanges.Uncommon.max},
              Rare {academyCoinEconomy.rarityPriceRanges.Rare.min}-{academyCoinEconomy.rarityPriceRanges.Rare.max},
              Epic {academyCoinEconomy.rarityPriceRanges.Epic.min}-{academyCoinEconomy.rarityPriceRanges.Epic.max},
              Legendary {academyCoinEconomy.rarityPriceRanges.Legendary.min}-{academyCoinEconomy.rarityPriceRanges.Legendary.max} coins.
            </p>
          </div>
          <AvatarRenderer
            items={[{
              id: form.id || "preview",
              name: form.name || "Preview",
              slug: form.slug || "preview",
              description: form.description,
              category: form.category,
              rarity: form.rarity,
              price: form.price,
              assetUrl: form.assetUrl || selectedItem?.assetUrl || null,
              thumbnailUrl: form.thumbnailUrl || form.assetUrl || selectedItem?.thumbnailUrl || null,
              layerOrder: form.layerOrder,
              unlockType: form.unlockType,
              unlockRequirement: form.unlockRequirement || null,
              isActive: form.isActive,
              isFeatured: form.isFeatured
            }]}
            avatar={{ studentId: "preview", equippedItems: { [form.category]: form.id || "preview" } }}
            size="lg"
            label="Avatar item preview"
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Name
            <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={form.name} onChange={(event) => setField("name", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Slug
            <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={form.slug} onChange={(event) => setField("slug", event.target.value)} placeholder="auto-created from name" />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Category
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={form.category} onChange={(event) => setField("category", event.target.value as AvatarCategory)}>
              {avatarCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Rarity
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={form.rarity} onChange={(event) => setField("rarity", event.target.value as AvatarRarity)}>
              {avatarRarities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Store Price (Academy Coins)
            <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white disabled:cursor-not-allowed disabled:opacity-50" type="number" min="0" step="1" disabled={form.unlockType !== "purchase"} value={form.price} onChange={(event) => setField("price", Math.max(0, Math.floor(Number(event.target.value) || 0)))} />
            <span className="text-[11px] normal-case text-slate-500">{form.unlockType === "purchase" ? "Students pay this amount in the Academy Armory." : "Choose the purchase unlock type to set a store price."}</span>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Layer Order
            <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" type="number" value={form.layerOrder} onChange={(event) => setField("layerOrder", Number(event.target.value) || 0)} />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Unlock Type
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={form.unlockType} onChange={(event) => setField("unlockType", event.target.value as AvatarUnlockType)}>
              {avatarUnlockTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400">Unlock Requirement
            <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={form.unlockRequirement} onChange={(event) => setField("unlockRequirement", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400 md:col-span-2">Asset URL or SVG Data URL
            <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={form.assetUrl} onChange={(event) => setField("assetUrl", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-400 md:col-span-2">Description
            <textarea className="min-h-24 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={form.description} onChange={(event) => setField("description", event.target.value)} />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setField("isActive", event.target.checked)} />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <input type="checkbox" checked={form.isFeatured} onChange={(event) => setField("isFeatured", event.target.checked)} />
            Featured
          </label>
          <span className={`rounded border px-2 py-1 text-xs font-bold ${avatarRarityStyles[form.rarity]}`}>{form.rarity}</span>
        </div>
        <Button className="mt-5" onClick={saveItem}>{form.id ? "Save Item" : "Create Item"}</Button>
      </Card>
    </div>
  );
}
