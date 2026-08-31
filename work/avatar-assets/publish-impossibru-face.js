const fs = require('node:fs/promises');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const bucket = 'avatar-assets';
const assets = [
  {
    localPath: 'work/avatar-assets/eyes/impossibru-squint.png',
    objectPath: 'eyes/impossibru-squint-v1.png',
    item: {
      name: 'Impossibru Squint',
      slug: 'impossibru-squint',
      description: 'The squeezed-shut stare from the legendary reaction face.',
      category: 'eyes',
      rarity: 'Rare',
      price: 40,
      layer_order: 20,
      unlock_type: 'purchase',
      unlock_requirement: null,
      is_active: true,
      is_featured: true
    }
  },
  {
    localPath: 'work/avatar-assets/eyebrows/impossibru-arches.png',
    objectPath: 'eyebrows/impossibru-arches-v1.png',
    item: {
      name: 'Impossibru Arches',
      slug: 'impossibru-arches',
      description: 'Sky-high tension brows for an impossibly baffled reaction.',
      category: 'eyebrows',
      rarity: 'Rare',
      price: 40,
      layer_order: 22,
      unlock_type: 'purchase',
      unlock_requirement: null,
      is_active: true,
      is_featured: true
    }
  },
  {
    localPath: 'work/avatar-assets/mouth/impossibru-grimace.png',
    objectPath: 'mouth/impossibru-grimace-v1.png',
    item: {
      name: 'Impossibru Grimace',
      slug: 'impossibru-grimace',
      description: 'A crooked clenched-teeth grimace for unbelievable positions.',
      category: 'mouth',
      rarity: 'Rare',
      price: 40,
      layer_order: 24,
      unlock_type: 'purchase',
      unlock_requirement: null,
      is_active: true,
      is_featured: true
    }
  }
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase admin environment variables are required.');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const rows = [];
  const remoteChecks = [];

  for (const asset of assets) {
    const file = await fs.readFile(asset.localPath);
    const localMetadata = await sharp(file).metadata();
    if (localMetadata.width !== 1024 || localMetadata.height !== 1024 || !localMetadata.hasAlpha) {
      throw new Error(`${asset.localPath} must be a transparent 1024x1024 PNG.`);
    }

    const { error: uploadError } = await supabase.storage.from(bucket).upload(asset.objectPath, file, {
      cacheControl: '31536000',
      contentType: 'image/png',
      upsert: false
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(asset.objectPath);
    rows.push({ ...asset.item, asset_url: publicData.publicUrl, thumbnail_url: publicData.publicUrl });

    const response = await fetch(publicData.publicUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${asset.objectPath} returned HTTP ${response.status}.`);
    const remoteMetadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    remoteChecks.push({
      path: asset.objectPath,
      status: response.status,
      width: remoteMetadata.width,
      height: remoteMetadata.height,
      hasAlpha: remoteMetadata.hasAlpha
    });
  }

  const { data: storedItems, error: upsertError } = await supabase
    .from('avatar_items')
    .upsert(rows, { onConflict: 'slug' })
    .select('id, name, slug, category, rarity, price, asset_url, layer_order, is_active, is_featured');
  if (upsertError) throw upsertError;

  const slugs = assets.map((asset) => asset.item.slug);
  const { data: verifiedItems, error: verifyError } = await supabase
    .from('avatar_items')
    .select('id, name, slug, category, rarity, price, asset_url, layer_order, is_active, is_featured')
    .in('slug', slugs)
    .order('slug');
  if (verifyError) throw verifyError;
  if (verifiedItems.length !== assets.length) throw new Error('Not all Impossibru parts were persisted.');

  console.log(JSON.stringify({ storedItems, verifiedItems, remoteChecks }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
