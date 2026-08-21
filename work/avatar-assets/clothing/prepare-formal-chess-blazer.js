const path = require('path');
const sharp = require('sharp');

const source = 'C:\\Users\\momin\\AppData\\Local\\Temp\\codex-clipboard-759bbe6d-caa7-4f37-9322-2d7685e30537.png';
const output = path.resolve(__dirname, 'formal-chess-blazer.png');

function isCheckerPixel(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  return r >= 225 && g >= 225 && b >= 225 && Math.max(r, g, b) - Math.min(r, g, b) <= 14;
}

async function main() {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const add = (x, y) => {
    const index = y * width + x;
    if (visited[index] || !isCheckerPixel(data, index * 4)) return;
    visited[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < width; x += 1) { add(x, 0); add(x, height - 1); }
  for (let y = 1; y < height - 1; y += 1) { add(0, y); add(width - 1, y); }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) add(x - 1, y);
    if (x + 1 < width) add(x + 1, y);
    if (y > 0) add(x, y - 1);
    if (y + 1 < height) add(x, y + 1);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < width * height; index += 1) {
    if (visited[index]) data[index * 4 + 3] = 0;
    if (data[index * 4 + 3] > 12) {
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) throw new Error('Garment could not be separated from its checkerboard background.');

  const garment = await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize({ width: 650, height: 540, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: garment, left: 187, top: 650 }])
    .png()
    .toFile(output);

  console.log(JSON.stringify({ output, sourceBounds: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 } }));
}

main().catch((error) => { console.error(error); process.exit(1); });
