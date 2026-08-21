const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const source = "C:/Users/momin/Downloads/Generated image 1.png";
const outputDir = "work/avatar-assets/accessories";
const output = path.join(outputDir, "queen-earrings-gold.png");

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
    return Math.min(red, green, blue) >= 205 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 26;
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

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * channels;
    if (background[pixel]) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    } else {
      data[offset + 3] = 255;
    }
  }

  await sharp(data, { raw: info })
    .resize(1024, 1024, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  const metadata = await sharp(output).metadata();
  const stats = await sharp(output).stats();
  console.log(JSON.stringify({ output, metadata, alpha: stats.channels[3] }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
