const fs = require("node:fs/promises");
const sharp = require("sharp");
const { createClient } = require("@supabase/supabase-js");

const version = process.argv[2];
if (!/^v\d+$/.test(version ?? "")) {
  throw new Error("Pass a version such as v1 as the first argument.");
}

const localPath = "work/avatar-assets/backgrounds/domain-expansion.png";
const bucket = "avatar-assets";
const objectPath = `backgrounds/domain-expansion-${version}.png`;

const item = {
  name: "Domain Expansion",
  slug: "domain-expansion",
  description: "An ominous cursed pocket dimension framed by fractured stone and supernatural energy.",
  category: "background",
  rarity: "Legendary",
  price: 400,
  layer_order: 0,
  unlock_type: "purchase",
  unlock_requirement: null,
  is_active: true,
  is_featured: true,
};

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are required.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const file = await fs.readFile(localPath);
  const localMetadata = await sharp(file).metadata();
  if (localMetadata.width !== 1024 || localMetadata.height !== 1024 || localMetadata.format !== "png") {
    throw new Error("Domain Expansion must be a 1024x1024 PNG.");
  }

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, file, {
    cacheControl: "31536000",
    contentType: "image/png",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const assetUrl = publicData.publicUrl;
  const { data: storedItem, error: upsertError } = await supabase
    .from("avatar_items")
    .upsert({ ...item, asset_url: assetUrl, thumbnail_url: assetUrl }, { onConflict: "slug" })
    .select("id, name, slug, category, rarity, price, asset_url, thumbnail_url, layer_order, unlock_type, is_active, is_featured")
    .single();
  if (upsertError) throw upsertError;

  const response = await fetch(assetUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Published background returned HTTP ${response.status}.`);
  const remoteMetadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  if (remoteMetadata.width !== 1024 || remoteMetadata.height !== 1024 || remoteMetadata.format !== "png") {
    throw new Error("The published background failed the remote PNG metadata check.");
  }

  const { data: verifiedItem, error: verifyError } = await supabase
    .from("avatar_items")
    .select("id, name, slug, category, rarity, price, asset_url, thumbnail_url, layer_order, unlock_type, is_active, is_featured")
    .eq("slug", item.slug)
    .single();
  if (verifyError) throw verifyError;

  console.log(JSON.stringify({
    version,
    storedItem,
    verifiedItem,
    remote: {
      status: response.status,
      width: remoteMetadata.width,
      height: remoteMetadata.height,
      format: remoteMetadata.format,
    },
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
