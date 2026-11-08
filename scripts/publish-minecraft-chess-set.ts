import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { minecraftChessSet } from "../lib/avatar/minecraftChessSet";

// Default is a read-only manifest preview. Publish only after the matching app release.
async function main() {
  const source = minecraftChessSet;
  const item = {
    id: source.id, name: source.name, slug: source.slug, description: source.description,
    category: source.category, rarity: source.rarity, price: source.price,
    asset_url: source.assetUrl, thumbnail_url: source.thumbnailUrl, layer_order: source.layerOrder,
    unlock_type: source.unlockType, unlock_requirement: source.unlockRequirement,
    is_active: source.isActive, is_featured: source.isFeatured
  };
  const local = await readFile("public/chess/themes/minecraft-preview.svg");
  if (!process.argv.includes("--publish")) {
    console.log(JSON.stringify({mode: "dry-run", item, previewBytes: local.length}, null, 2));
    return;
  }
  // Prevent a purchasable listing appearing before playable client code is deployed.
  const response = await fetch("https://thechessacademy.vercel.app" + source.assetUrl, {cache: "no-store", signal: AbortSignal.timeout(20000)});
  if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(local)) {
    throw new Error("Deploy the matching application and verify the playable set before publishing its catalog entry.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !secret || !publicKey) throw new Error("Supabase server and public credentials are required.");
  const options = {auth: {persistSession: false}};
  const db = createClient(url, secret, options);
  const {data: existing, error: readError} = await db.from("avatar_items").select("*").eq("slug", item.slug).maybeSingle();
  if (readError) throw readError;
  if (!existing) {
    const {error} = await db.from("avatar_items").insert(item);
    if (error) throw error;
  }
  const publicDb = createClient(url, publicKey, options);
  const {data: verified, error} = await publicDb.from("avatar_items").select("*").eq("slug", item.slug).single();
  if (error) throw error;
  for (const [field, expected] of Object.entries(item)) {
    if (verified[field] !== expected) throw new Error("Existing catalog row differs; refusing to overwrite: " + field);
  }
  console.log(JSON.stringify({published: true, id: verified.id, name: verified.name, price: verified.price, rarity: verified.rarity, publicRead: true}));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
