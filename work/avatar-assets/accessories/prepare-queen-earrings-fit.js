const path = require('path');
const sharp = require('sharp');

const source = path.resolve(__dirname, 'queen-earrings-original.png');
const output = path.resolve(__dirname, 'queen-earrings-gold.png');

async function boundsForHalf(leftHalf) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if ((leftHalf ? x < info.width / 2 : x >= info.width / 2) && data[(y * info.width + x) * 4 + 3] > 12) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main() {
  const leftBounds = await boundsForHalf(true);
  const rightBounds = await boundsForHalf(false);
  const scale = 0.58;
  const left = await sharp(source).extract(leftBounds).resize({ width: Math.round(leftBounds.width * scale), height: Math.round(leftBounds.height * scale) }).png().toBuffer();
  const right = await sharp(source).extract(rightBounds).resize({ width: Math.round(rightBounds.width * scale), height: Math.round(rightBounds.height * scale) }).png().toBuffer();
  const leftWidth = Math.round(leftBounds.width * scale);
  const rightWidth = Math.round(rightBounds.width * scale);

  // Anchor each stud at the avatar's lower ear line; the drops then hang below.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: left, left: 198 - Math.floor(leftWidth / 2), top: 520 },
      { input: right, left: 826 - Math.floor(rightWidth / 2), top: 520 },
    ])
    .png()
    .toFile(output);
  console.log(JSON.stringify({ output, leftBounds, rightBounds }));
}

main().catch((error) => { console.error(error); process.exit(1); });
