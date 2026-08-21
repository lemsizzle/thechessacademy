const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const source = "C:/Users/momin/AppData/Local/Temp/codex-clipboard-5d886d4d-2468-41b0-9724-e501c6a8b401.png";
const outputDir = "work/avatar-assets/hair";
const output = path.join(outputDir, "tousled-brown-hair.png");

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const background = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const qualifies = (pixel) => {
    const offset = pixel * channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return Math.min(red, green, blue) >= 175 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 34;
  };

  const enqueue = (pixel) => {
    if (!background[pixel] && qualifies(pixel)) {
      background[pixel] = 1;
      queue[tail++] = pixel;
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * channels;
    if (background[pixel]) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
      continue;
    }
    data[offset + 3] = 255;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const hair = await sharp(data, { raw: info })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize({ width: 670, height: 400, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: hair, left: 177, top: 100 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(JSON.stringify({ output, placement: { left: 177, top: 100, width: 670, height: 400 }, sourceBounds: { minX, minY, maxX, maxY } }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
