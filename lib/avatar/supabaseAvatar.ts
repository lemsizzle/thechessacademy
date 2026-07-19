import { defaultAvatarItemSlugs, getDefaultEquippedItems, normalizeAvatarCategory, normalizeAvatarRarity, normalizeUnlockType, seedAvatarItems } from "@/lib/avatar/catalog";
import { coinsFromXp, normalizeAvatarPrice } from "@/lib/avatar/economy";
import { canEquipAvatarItem } from "@/lib/avatar/rules";
import { getSupabaseServerReadClient, getSupabaseServiceClient, isSupabaseProjectConfigured, isSupabaseServiceConfigured } from "@/lib/supabase/server";
import type { AvatarAcquisitionType, AvatarCategory, AvatarItem, AvatarRarity, AvatarUnlockType, CoinTransaction, StudentAvatarConfig, StudentInventoryItem, StudentWallet } from "@/lib/types";

type AvatarItemRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  rarity: string;
  price: number | null;
  asset_url: string | null;
  thumbnail_url: string | null;
  layer_order: number | null;
  unlock_type: string | null;
  unlock_requirement: string | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  created_at?: string;
  updated_at?: string;
};

type InventoryRow = {
  id: string;
  student_id: string;
  item_id: string;
  acquisition_type: string | null;
  acquired_at: string;
};

type WalletRow = {
  student_id: string;
  academy_coins: number | null;
  total_coins_earned: number | null;
  total_coins_spent: number | null;
  updated_at?: string;
};

type AvatarRow = {
  student_id: string;
  equipped_items: Record<string, string | null> | null;
  updated_at?: string;
};

export type StudentAvatarState = {
  configured: boolean;
  items: AvatarItem[];
  inventory: StudentInventoryItem[];
  ownedItemIds: string[];
  wallet: StudentWallet;
  avatar: StudentAvatarConfig;
  source: "supabase" | "seed";
};

export type AvatarItemInput = {
  name: string;
  slug?: string;
  description?: string;
  category: AvatarCategory;
  rarity: AvatarRarity;
  price: number;
  assetUrl?: string | null;
  thumbnailUrl?: string | null;
  layerOrder?: number;
  unlockType: AvatarUnlockType;
  unlockRequirement?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `avatar-item-${Date.now()}`;
}

function toItem(row: AvatarItemRow): AvatarItem {
  const seed = seedAvatarItems.find((item) => item.slug === row.slug);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    category: normalizeAvatarCategory(row.category),
    rarity: normalizeAvatarRarity(row.rarity),
    price: Math.max(0, Number(row.price ?? 0)),
    assetUrl: row.asset_url ?? seed?.assetUrl ?? null,
    thumbnailUrl: row.thumbnail_url ?? row.asset_url ?? seed?.thumbnailUrl ?? null,
    layerOrder: Number(row.layer_order ?? 0),
    unlockType: normalizeUnlockType(row.unlock_type ?? "purchase"),
    unlockRequirement: row.unlock_requirement,
    isActive: row.is_active ?? true,
    isFeatured: row.is_featured ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toInventory(row: InventoryRow): StudentInventoryItem {
  return {
    id: row.id,
    studentId: row.student_id,
    itemId: row.item_id,
    acquisitionType: (row.acquisition_type ?? "admin_grant") as AvatarAcquisitionType,
    acquiredAt: row.acquired_at
  };
}

function toWallet(row: WalletRow): StudentWallet {
  return {
    studentId: row.student_id,
    academyCoins: Math.max(0, Number(row.academy_coins ?? 0)),
    totalCoinsEarned: Math.max(0, Number(row.total_coins_earned ?? 0)),
    totalCoinsSpent: Math.max(0, Number(row.total_coins_spent ?? 0)),
    updatedAt: row.updated_at
  };
}

function normalizeEquippedItems(value: Record<string, string | null> | null | undefined) {
  const next: Partial<Record<AvatarCategory, string>> = {};
  for (const [key, itemId] of Object.entries(value ?? {})) {
    if (!itemId) continue;
    next[normalizeAvatarCategory(key)] = itemId;
  }
  return next;
}

function fallbackState(studentId: string): StudentAvatarState {
  const defaultIds = new Set(defaultAvatarItemSlugs);
  const freeItems = seedAvatarItems.filter((item) => defaultIds.has(item.slug) || item.unlockType === "default");
  const now = new Date().toISOString();
  return {
    configured: isSupabaseProjectConfigured(),
    items: seedAvatarItems,
    inventory: freeItems.map((item) => ({
      id: `seed-inventory-${studentId}-${item.slug}`,
      studentId,
      itemId: item.id,
      acquisitionType: "default",
      acquiredAt: now
    })),
    ownedItemIds: freeItems.map((item) => item.id),
    wallet: { studentId, academyCoins: 0, totalCoinsEarned: 0, totalCoinsSpent: 0, updatedAt: now },
    avatar: { studentId, equippedItems: getDefaultEquippedItems(seedAvatarItems), updatedAt: now },
    source: "seed"
  };
}

export async function listAvatarItems(options: { includeInactive?: boolean; useService?: boolean } = {}) {
  const supabase = options.useService ? getSupabaseServiceClient() : (getSupabaseServerReadClient() ?? getSupabaseServiceClient());
  if (!supabase) return seedAvatarItems.filter((item) => options.includeInactive || item.isActive);

  const query = supabase
    .from("avatar_items")
    .select("id,name,slug,description,category,rarity,price,asset_url,thumbnail_url,layer_order,unlock_type,unlock_requirement,is_active,is_featured,created_at,updated_at")
    .order("layer_order", { ascending: true })
    .order("name", { ascending: true });

  const { data, error } = options.includeInactive ? await query : await query.eq("is_active", true);
  if (error) return seedAvatarItems.filter((item) => options.includeInactive || item.isActive);
  const items = ((data ?? []) as AvatarItemRow[]).map(toItem);
  return items.length ? items : seedAvatarItems.filter((item) => options.includeInactive || item.isActive);
}

async function ensureWallet(studentId: string): Promise<StudentWallet> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return fallbackState(studentId).wallet;

  const existing = await supabase
    .from("student_wallets")
    .select("student_id,academy_coins,total_coins_earned,total_coins_spent,updated_at")
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return toWallet(existing.data as WalletRow);

  const student = await supabase.from("students").select("total_xp").eq("id", studentId).maybeSingle();
  if (student.error) throw new Error(student.error.message);
  const startingCoins = coinsFromXp(Number((student.data as { total_xp?: number | null } | null)?.total_xp ?? 0));

  const inserted = await supabase
    .from("student_wallets")
    .insert({
      student_id: studentId,
      academy_coins: startingCoins,
      total_coins_earned: startingCoins,
      total_coins_spent: 0
    })
    .select("student_id,academy_coins,total_coins_earned,total_coins_spent,updated_at")
    .single();

  if (inserted.error) throw new Error(inserted.error.message);
  if (startingCoins > 0) {
    await supabase.from("coin_transactions").upsert({
      student_id: studentId,
      amount: startingCoins,
      transaction_type: "earn",
      source_type: "xp_backfill",
      source_id: studentId,
      description: "Starting Academy Coins from existing XP.",
      idempotency_key: `xp-backfill:${studentId}`
    }, { onConflict: "idempotency_key" });
  }
  return toWallet(inserted.data as WalletRow);
}

async function ensureDefaultInventory(studentId: string, items: AvatarItem[]) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return fallbackState(studentId).inventory;

  const defaultItems = items.filter((item) => defaultAvatarItemSlugs.includes(item.slug) || item.unlockType === "default");
  if (defaultItems.length) {
    const rows = defaultItems.map((item) => ({
      student_id: studentId,
      item_id: item.id,
      acquisition_type: "default"
    }));
    const { error } = await supabase.from("student_inventory").upsert(rows, { onConflict: "student_id,item_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  const inventory = await supabase
    .from("student_inventory")
    .select("id,student_id,item_id,acquisition_type,acquired_at")
    .eq("student_id", studentId);

  if (inventory.error) throw new Error(inventory.error.message);
  return ((inventory.data ?? []) as InventoryRow[]).map(toInventory);
}

async function ensureAvatar(studentId: string, items: AvatarItem[], inventory: StudentInventoryItem[]) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return fallbackState(studentId).avatar;

  const existing = await supabase
    .from("student_avatar")
    .select("student_id,equipped_items,updated_at")
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    return {
      studentId,
      equippedItems: normalizeEquippedItems((existing.data as AvatarRow).equipped_items),
      updatedAt: (existing.data as AvatarRow).updated_at
    };
  }

  const ownedIds = new Set(inventory.map((item) => item.itemId));
  const defaultEquipped = getDefaultEquippedItems(items.filter((item) => ownedIds.has(item.id)));
  const inserted = await supabase
    .from("student_avatar")
    .insert({ student_id: studentId, equipped_items: defaultEquipped })
    .select("student_id,equipped_items,updated_at")
    .single();

  if (inserted.error) throw new Error(inserted.error.message);
  return {
    studentId,
    equippedItems: normalizeEquippedItems((inserted.data as AvatarRow).equipped_items),
    updatedAt: (inserted.data as AvatarRow).updated_at
  };
}

export async function getStudentAvatarState(studentId: string): Promise<StudentAvatarState> {
  if (!isSupabaseServiceConfigured()) return fallbackState(studentId);

  try {
    const items = await listAvatarItems({ includeInactive: false, useService: true });
    const wallet = await ensureWallet(studentId);
    const inventory = await ensureDefaultInventory(studentId, items);
    const avatar = await ensureAvatar(studentId, items, inventory);
    return {
      configured: true,
      items,
      inventory,
      ownedItemIds: inventory.map((item) => item.itemId),
      wallet,
      avatar,
      source: "supabase"
    };
  } catch {
    return fallbackState(studentId);
  }
}

export async function getStudentAvatarDisplayData(studentIds: string[]) {
  const uniqueStudentIds = Array.from(new Set(studentIds.filter(Boolean)));
  const items = await listAvatarItems({ includeInactive: false, useService: true });
  const defaultEquippedItems = getDefaultEquippedItems(items);
  const avatars: Record<string, StudentAvatarConfig> = Object.fromEntries(
    uniqueStudentIds.map((studentId) => [studentId, { studentId, equippedItems: defaultEquippedItems }])
  );

  const supabase = getSupabaseServiceClient();
  if (!supabase || !uniqueStudentIds.length) return { items, avatars };

  const result = await supabase
    .from("student_avatar")
    .select("student_id,equipped_items,updated_at")
    .in("student_id", uniqueStudentIds);

  if (result.error) return { items, avatars };
  for (const row of (result.data ?? []) as AvatarRow[]) {
    avatars[row.student_id] = {
      studentId: row.student_id,
      equippedItems: normalizeEquippedItems(row.equipped_items),
      updatedAt: row.updated_at
    };
  }

  return { items, avatars };
}

export async function purchaseAvatarItem(studentId: string, itemId: string) {
  if (!isSupabaseServiceConfigured()) {
    throw new Error("Supabase service role is required for secure purchases.");
  }
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const { error } = await supabase.rpc("purchase_avatar_item", {
    p_student_id: studentId,
    p_item_id: itemId
  });

  if (error) throw new Error(error.message);
  return getStudentAvatarState(studentId);
}

export async function saveStudentAvatar(studentId: string, equippedItems: Partial<Record<AvatarCategory, string | null>>) {
  if (!isSupabaseServiceConfigured()) {
    throw new Error("Supabase service role is required to save avatars.");
  }
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const state = await getStudentAvatarState(studentId);
  const owned = new Set(state.ownedItemIds);
  const byId = new Map(state.items.map((item) => [item.id, item]));
  const next: Partial<Record<AvatarCategory, string>> = {};

  for (const [categoryKey, itemId] of Object.entries(equippedItems)) {
    const category = normalizeAvatarCategory(categoryKey);
    const validation = canEquipAvatarItem(itemId ?? null, owned);
    if (!validation.ok) throw new Error(validation.reason);
    if (!itemId) continue;
    const item = byId.get(itemId);
    if (!item) throw new Error("Avatar item not found.");
    if (item.category !== category) throw new Error(`${item.name} cannot be equipped in that slot.`);
    next[category] = itemId;
  }

  const { error } = await supabase
    .from("student_avatar")
    .upsert({ student_id: studentId, equipped_items: next, updated_at: new Date().toISOString() }, { onConflict: "student_id" });

  if (error) throw new Error(error.message);
  return getStudentAvatarState(studentId);
}

function toAvatarItemPayload(input: AvatarItemInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Item name is required.");
  const slug = slugify(input.slug || name);
  const unlockType = input.unlockType;
  return {
    name,
    slug,
    description: input.description?.trim() || "",
    category: input.category,
    rarity: input.rarity,
    price: normalizeAvatarPrice({ slug, price: input.price, unlockType }),
    asset_url: input.assetUrl || null,
    thumbnail_url: input.thumbnailUrl || input.assetUrl || null,
    layer_order: Number(input.layerOrder ?? 0),
    unlock_type: unlockType,
    unlock_requirement: input.unlockRequirement?.trim() || null,
    is_active: input.isActive ?? true,
    is_featured: input.isFeatured ?? false
  };
}

export async function createAvatarItem(input: AvatarItemInput) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for avatar item management.");
  const { data, error } = await supabase
    .from("avatar_items")
    .insert(toAvatarItemPayload(input))
    .select("id,name,slug,description,category,rarity,price,asset_url,thumbnail_url,layer_order,unlock_type,unlock_requirement,is_active,is_featured,created_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return toItem(data as AvatarItemRow);
}

export async function updateAvatarItem(itemId: string, input: Partial<AvatarItemInput>) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for avatar item management.");
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.slug !== undefined || input.name !== undefined) payload.slug = slugify(input.slug || input.name || itemId);
  if (input.description !== undefined) payload.description = input.description.trim();
  if (input.category !== undefined) payload.category = input.category;
  if (input.rarity !== undefined) payload.rarity = input.rarity;
  if (input.unlockType !== undefined && input.unlockType !== "purchase") {
    payload.price = 0;
  } else if (input.price !== undefined) {
    const slug = String(payload.slug ?? itemId);
    const unlockType = (input.unlockType ?? "purchase") as AvatarUnlockType;
    payload.price = normalizeAvatarPrice({ slug, price: Number(input.price ?? 0), unlockType });
  }
  if (input.assetUrl !== undefined) payload.asset_url = input.assetUrl || null;
  if (input.thumbnailUrl !== undefined) payload.thumbnail_url = input.thumbnailUrl || input.assetUrl || null;
  if (input.layerOrder !== undefined) payload.layer_order = Number(input.layerOrder) || 0;
  if (input.unlockType !== undefined) payload.unlock_type = input.unlockType;
  if (input.unlockRequirement !== undefined) payload.unlock_requirement = input.unlockRequirement?.trim() || null;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.isFeatured !== undefined) payload.is_featured = input.isFeatured;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("avatar_items")
    .update(payload)
    .eq("id", itemId)
    .select("id,name,slug,description,category,rarity,price,asset_url,thumbnail_url,layer_order,unlock_type,unlock_requirement,is_active,is_featured,created_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return toItem(data as AvatarItemRow);
}

export async function grantAvatarItem(studentId: string, itemId: string, acquisitionType: AvatarAcquisitionType = "admin_grant") {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to grant avatar items.");
  const { data, error } = await supabase
    .from("student_inventory")
    .upsert({ student_id: studentId, item_id: itemId, acquisition_type: acquisitionType }, { onConflict: "student_id,item_id" })
    .select("id,student_id,item_id,acquisition_type,acquired_at")
    .single();
  if (error) throw new Error(error.message);
  return toInventory(data as InventoryRow);
}

export async function adjustStudentCoins(studentId: string, amount: number, description: string, sourceId = crypto.randomUUID()) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to adjust Academy Coins.");
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) throw new Error("Coin adjustment must be a non-zero number.");

  const { error } = await supabase.rpc("grant_academy_coins", {
    p_student_id: studentId,
    p_amount: value,
    p_transaction_type: value > 0 ? "adjustment" : "adjustment",
    p_source_type: "admin_adjustment",
    p_source_id: sourceId,
    p_description: description || "Teacher Academy Coins adjustment",
    p_idempotency_key: `admin-adjustment:${sourceId}`
  });
  if (error) throw new Error(error.message);
  return ensureWallet(studentId);
}

export async function grantAcademyCoinsForXp(studentId: string, amount: number, sourceType: string, sourceId: string, description: string) {
  const value = Math.max(0, Number(amount) || 0);
  if (!value || !isSupabaseServiceConfigured()) return null;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const result = await supabase.rpc("grant_academy_coins", {
    p_student_id: studentId,
    p_amount: value,
    p_transaction_type: "earn",
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_description: description,
    p_idempotency_key: `${sourceType}:${sourceId}`
  });

  if (result.error) return null;
  return result.data as CoinTransaction | null;
}

export async function getStudentWallet(studentId: string) {
  if (!isSupabaseServiceConfigured()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to read Academy Coin balances.");
  }
  return ensureWallet(studentId);
}

export async function syncAcademyCoinsForLichessXp(studentId: string, cumulativeLichessXp: number) {
  const target = Math.max(0, Math.floor(Number(cumulativeLichessXp) || 0));
  if (!isSupabaseServiceConfigured()) return { coinsAwarded: 0, cumulativeLichessXp: target };
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { coinsAwarded: 0, cumulativeLichessXp: target };

  const result = await supabase.rpc("sync_lichess_xp_coins", {
    p_student_id: studentId,
    p_cumulative_lichess_xp: target
  });
  if (result.error) throw new Error(result.error.message);
  const data = (result.data ?? {}) as { coinsAwarded?: number; cumulativeLichessXp?: number };
  return {
    coinsAwarded: Math.max(0, Number(data.coinsAwarded ?? 0)),
    cumulativeLichessXp: Math.max(target, Number(data.cumulativeLichessXp ?? target))
  };
}
