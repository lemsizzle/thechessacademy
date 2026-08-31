const sharp = require('sharp');

const canvasSize = 1024;
const assets = [
  {
    source: 'work/avatar-assets/eyes/impossibru-squint-source.png',
    output: 'work/avatar-assets/eyes/impossibru-squint.png',
    width: 400,
    top: 407
  },
  {
    source: 'work/avatar-assets/eyebrows/impossibru-arches-source.png',
    output: 'work/avatar-assets/eyebrows/impossibru-arches.png',
    width: 400,
    top: 292
  },
  {
    source: 'work/avatar-assets/mouth/impossibru-grimace-source.png',
    output: 'work/avatar-assets/mouth/impossibru-grimace.png',
    width: 260,
    top: 551
  }
];

function isLightNeutral(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);
  return minimum > 190 && maximum - minimum < 30;
}

async function removeConnectedCheckerboard(source) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  function enqueue(x, y) {
    const index = y * info.width + x;
    if (visited[index] || !isLightNeutral(data, index * 4)) return;
    visited[index] = 1;
    queue[queueEnd++] = index;
  }

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, info.height - 1);
  }
  for (let y = 0; y < info.height; y += 1) {
    enqueue(0, y);
    enqueue(info.width - 1, y);
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart++];
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    data[index * 4 + 3] = 0;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < info.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < info.height) enqueue(x, y + 1);
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

async function prepareAsset(asset) {
  const transparentSource = await removeConnectedCheckerboard(asset.source);
  const trimmed = await sharp(transparentSource)
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

async function createPreview() {
  const base = Buffer.from(`
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="1024" rx="52" fill="#020617"/>
      <circle cx="243" cy="480" r="64" fill="#c98b68"/>
      <circle cx="781" cy="480" r="64" fill="#c98b68"/>
      <circle cx="512" cy="461" r="275" fill="#c98b68"/>
      <rect x="429" y="646" width="166" height="173" rx="64" fill="#c98b68"/>
    </svg>
  `);
  await sharp(base)
    .composite(assets.map((asset) => ({ input: asset.output })))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile('work/avatar-assets/impossibru-face-preview.png');
}

async function main() {
  const results = [];
  for (const asset of assets) results.push(await prepareAsset(asset));
  await createPreview();
  console.log(JSON.stringify({ results, preview: 'work/avatar-assets/impossibru-face-preview.png' }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
