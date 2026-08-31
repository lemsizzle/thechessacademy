const fs = require('node:fs/promises');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const bucket = 'avatar-assets';
const assets = [
  {
    localPath: 'work/avatar-assets/eyebrows/thick-unibrow.png',
    objectPath: 'eyebrows/thick-uni-brow-v1.png',
    item: {
      name: 'Thick Uni-Brow',
      slug: 'thick-uni-brow',
      description: 'One bold connected brow for an unmistakably focused look.',
      category: 'eyebrows',
      rarity: 'Common',
      price: 15,
      layer_order: 22,
      unlock_type: 'purchase',
      unlock_requirement: null,
      is_active: true,
      is_featured: true
    }
  },
  {
    localPath: 'work/avatar-assets/eyebrows/elegant-arched-brows.png',
    objectPath: 'eyebrows/elegant-arched-brows-v1.png',
    item: {
      name: 'Elegant Arched Brows',
      slug: 'elegant-arched-brows',
      description: 'Graceful feminine-styled arches with polished tapered ends.',
      category: 'eyebrows',
      rarity: 'Uncommon',
      price: 25,
      layer_order: 22,
      unlock_type: 'purchase',
      unlock_requirement: null,
      is_active: true,
      is_featured: true
    }
  },
  {
    localPath: 'work/avatar-assets/mouth/smirk-mouth.png',
    objectPath: 'mouth/smirk-mouth-v1.png',
    item: {
      name: 'Smirk Mouth',
      slug: 'smirk-mouth',
      description: 'A playful asymmetrical smirk for confident positions.',
      category: 'mouth',
      rarity: 'Uncommon',
      price: 30,
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
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin environment variables are required.');
  }

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

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(asset.objectPath, file, {
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
  if (verifiedItems.length !== assets.length) throw new Error('Not all avatar items were persisted.');

  console.log(JSON.stringify({ storedItems, verifiedItems, remoteChecks }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
