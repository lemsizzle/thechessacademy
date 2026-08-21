const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const source = 'C:\\Users\\momin\\AppData\\Local\\Temp\\codex-clipboard-0a0ad94e-e68b-43a4-b56d-44ee317dcb7f.png';
const output = path.resolve(__dirname, 'bishop-buddy.png');

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

  const bishop = await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize({ width: 220, height: 360, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: bishop, left: 110, top: 595 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(JSON.stringify({ output, sourceBounds: { left, top, right, bottom }, placement: { left: 110, top: 595, width: 220, height: 360 } }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
