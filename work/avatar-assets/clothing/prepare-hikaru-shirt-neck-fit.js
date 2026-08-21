const path = require('path');
const sharp = require('sharp');

const source = path.resolve(__dirname, 'hikaru-shirt-original.png');
const output = path.resolve(__dirname, 'hikaru-shirt-neck-fit.png');

async function main() {
  // The original collar began at y=650, which overlaps the avatar's chin.
  // The avatar's shoulder/neck transition is y=685–736, so a 56px vertical
  // offset lets the collar sit around the neck instead of on the face.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: source, left: 0, top: 56 }])
    .png()
    .toFile(output);

  const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * 4 + 3] > 12) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  console.log(JSON.stringify({ output, bounds: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 } }));
}

main().catch((error) => { console.error(error); process.exit(1); });
