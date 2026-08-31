const fs = require('node:fs/promises');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const localPath = 'work/avatar-assets/aura/super-saiyan.png';
const bucket = 'avatar-assets';
const objectPath = 'aura/super-saiyan-v4.png';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin environment variables are required.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const asset = await fs.readFile(localPath);
  const localMetadata = await sharp(asset).metadata();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, asset, {
      cacheControl: '31536000',
      contentType: 'image/png',
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const assetUrl = publicData.publicUrl;
  const { data: updatedItem, error: updateError } = await supabase
    .from('avatar_items')
    .update({ asset_url: assetUrl })
    .eq('slug', 'super-saiyan')
    .select('id, slug, name, rarity, price, asset_url, is_active, is_featured')
    .single();

  if (updateError) throw updateError;

  const response = await fetch(assetUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Published asset returned HTTP ${response.status}.`);
  const remoteAsset = Buffer.from(await response.arrayBuffer());
  const remoteMetadata = await sharp(remoteAsset).metadata();

  console.log(JSON.stringify({
    updatedItem,
    local: { width: localMetadata.width, height: localMetadata.height, hasAlpha: localMetadata.hasAlpha },
    remote: { status: response.status, width: remoteMetadata.width, height: remoteMetadata.height, hasAlpha: remoteMetadata.hasAlpha }
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
