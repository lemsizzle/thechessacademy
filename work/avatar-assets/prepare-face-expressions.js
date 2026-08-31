const sharp = require('sharp');

const canvasSize = 1024;
const assets = [
  {
    source: 'work/avatar-assets/eyebrows/thick-unibrow-source.png',
    output: 'work/avatar-assets/eyebrows/thick-unibrow.png',
    width: 430,
    top: 310
  },
  {
    source: 'work/avatar-assets/eyebrows/elegant-arched-brows-source.png',
    output: 'work/avatar-assets/eyebrows/elegant-arched-brows.png',
    width: 390,
    top: 332
  },
  {
    source: 'work/avatar-assets/mouth/smirk-mouth-source-v3.png',
    output: 'work/avatar-assets/mouth/smirk-mouth.png',
    width: 250,
    top: 568,
    removeLightNeutralBackground: true
  }
];

async function getTransparentSource(asset) {
  if (!asset.removeLightNeutralBackground) {
    return sharp(asset.source).ensureAlpha().png().toBuffer();
  }

  const { data, info } = await sharp(asset.source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const minimum = Math.min(red, green, blue);
    const maximum = Math.max(red, green, blue);
    if (minimum > 205 && maximum - minimum < 24) data[offset + 3] = 0;
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

async function prepareAsset(asset) {
  const source = await getTransparentSource(asset);
  const trimmed = await sharp(source)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({ width: asset.width, fit: 'inside', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const metadata = await sharp(trimmed).metadata();
  const left = Math.round((canvasSize - metadata.width) / 2);

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: trimmed, left, top: asset.top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(asset.output);

  return {
    output: asset.output,
    placement: { left, top: asset.top, width: metadata.width, height: metadata.height }
  };
}

async function main() {
  const results = [];
  for (const asset of assets) results.push(await prepareAsset(asset));
  console.log(JSON.stringify(results));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
