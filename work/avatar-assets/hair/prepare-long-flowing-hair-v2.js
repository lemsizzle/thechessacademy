const path = require('path');
const sharp = require('sharp');

const source = path.join(__dirname, 'long-flowing-hair-v2-source.png');
const output = path.join(__dirname, 'long-flowing-hair.png');

function isLightNeutral(r, g, b) {
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  // Include the near-white anti-aliased fringe that was blended against the
  // flattened checkerboard, while keeping the warm brown hair highlights.
  return high >= 190 && high - low <= 35;
}

function removeFlattenedCheckerboard(data, info) {
  const pixelCount = info.width * info.height;
  const background = new Uint8Array(pixelCount);
  const queued = new Uint8Array(pixelCount);
  const queue = [];

  const enqueue = (x, y) => {
    const index = y * info.width + x;
    const offset = index * 4;
    if (queued[index] || !isLightNeutral(data[offset], data[offset + 1], data[offset + 2])) return;
    queued[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, info.height - 1);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    enqueue(0, y);
    enqueue(info.width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    background[index] = 1;
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < info.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < info.height) enqueue(x, y + 1);
  }

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    // The generator flattened a pale checkerboard into the image. Clear every
    // checker-colored pixel, including small areas fully enclosed by a lock.
    if (background[index] || isLightNeutral(data[offset], data[offset + 1], data[offset + 2])) {
      data[offset + 3] = 0;
    }
  }
  return background.reduce((count, value) => count + value, 0);
}

function alphaBounds(data, info) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left || bottom < top) throw new Error('The source image contains no visible pixels.');
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function main() {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const clearedBackgroundPixels = removeFlattenedCheckerboard(data, info);
  const bounds = alphaBounds(data, info);
  const cropped = await sharp(data, { raw: info })
    .extract(bounds)
    .resize({ width: 590, height: 660, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cropped, left: 217, top: 60 }])
    .ensureAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(JSON.stringify({ source, output, bounds, clearedBackgroundPixels, placement: { left: 217, top: 60, width: 590, height: 660 } }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
