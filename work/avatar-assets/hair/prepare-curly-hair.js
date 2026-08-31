const sharp = require("sharp");

const source = "work/avatar-assets/hair/curly-hair-source.png";
const output = "work/avatar-assets/hair/curly-hair.png";

async function main() {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const hair = await sharp(data, { raw: info })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize({ height: 680, fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer({ resolveWithObject: true });

  const left = Math.round((1024 - hair.info.width) / 2);
  const top = 80;
  const canvas = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: hair.data, left, top }])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Keep the eye line and face clear for every compatible facial cosmetic.
  for (let y = 320; y < canvas.info.height; y += 1) {
    for (let x = 0; x < canvas.info.width; x += 1) {
      const distance = ((x - 512) / 240) ** 2 + ((y - 515) / 260) ** 2;
      if (distance >= 1.03) continue;
      const offset = (y * canvas.info.width + x) * 4 + 3;
      const alpha = canvas.data[offset];
      canvas.data[offset] = distance <= 1 ? 0 : Math.round(alpha * ((distance - 1) / 0.03));
    }
  }

  await sharp(canvas.data, { raw: canvas.info })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(JSON.stringify({ output, left, top, width: hair.info.width, height: hair.info.height }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
