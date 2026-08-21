const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const source = 'C:\\Users\\momin\\AppData\\Local\\Temp\\codex-clipboard-5bdded57-0c3c-4c1d-ae1a-d5ce73a52599.png';
const output = path.resolve(__dirname, 'googly-eyes.png');

async function main() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let left = width, top = height, right = -1, bottom = -1;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (data[pixel * 4 + 3] <= 12) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }

  const eyes = await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize({ width: 420, height: 208, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: eyes, left: 302, top: 344 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(JSON.stringify({ output, sourceBounds: { left, top, right, bottom }, placement: { left: 302, top: 344, width: 420, height: 208 } }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
