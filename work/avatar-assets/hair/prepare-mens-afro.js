const sharp = require("sharp");

const source = "work/avatar-assets/hair/mens-afro-source.png";
const output = "work/avatar-assets/hair/mens-afro.png";

async function main() {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const normalizedX = (x - info.width / 2) / 440;
      const lowerHairEdge = 515 - 170 * normalizedX ** 2;
      if (y > lowerHairEdge) data[offset + 3] = 0;
      if (data[offset + 3] > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const hair = await sharp(data, { raw: info })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize({ width: 620, fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer({ resolveWithObject: true });

  const canvas = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: hair.data, left: 202, top: 105 }])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  await sharp(canvas.data, { raw: canvas.info })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(JSON.stringify({ output, left: 202, top: 105, width: hair.info.width, height: hair.info.height }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
