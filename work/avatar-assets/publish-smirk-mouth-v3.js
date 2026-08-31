const fs = require('node:fs/promises');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const localPath = 'work/avatar-assets/mouth/smirk-mouth.png';
const bucket = 'avatar-assets';
const objectPath = 'mouth/smirk-mouth-v3.png';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase admin environment variables are required.');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const file = await fs.readFile(localPath);
  const localMetadata = await sharp(file).metadata();
  if (localMetadata.width !== 1024 || localMetadata.height !== 1024 || !localMetadata.hasAlpha) {
    throw new Error('The smirk must be a transparent 1024x1024 PNG.');
  }

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, file, {
    cacheControl: '31536000',
    contentType: 'image/png',
    upsert: false
  });
  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const { data: item, error: updateError } = await supabase
    .from('avatar_items')
    .update({ asset_url: publicData.publicUrl, thumbnail_url: publicData.publicUrl })
    .eq('slug', 'smirk-mouth')
    .select('id, name, slug, category, rarity, price, asset_url, layer_order, is_active, is_featured')
    .single();
  if (updateError) throw updateError;

  const response = await fetch(publicData.publicUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Published smirk returned HTTP ${response.status}.`);
  const remoteMetadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();

  console.log(JSON.stringify({
    item,
    remote: {
      status: response.status,
      width: remoteMetadata.width,
      height: remoteMetadata.height,
      hasAlpha: remoteMetadata.hasAlpha
    }
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
