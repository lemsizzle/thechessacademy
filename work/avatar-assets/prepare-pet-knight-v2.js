const sharp = require("sharp");

const source = "work/avatar-assets/accessories/golden-knight-pet-v2-chroma.png";
const output = "work/avatar-assets/accessories/golden-knight-pet-v2.png";

async function main() {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const distance = Math.sqrt(red ** 2 + (green - 255) ** 2 + blue ** 2);
      const alpha = distance <= 30 ? 0 : distance >= 180 ? 255 : Math.round(((distance - 30) / 150) * 255);

      if (alpha < 245) data[offset + 1] = Math.min(green, Math.max(red, blue) + 18);
      data[offset + 3] = alpha;

      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const keyed = sharp(data, { raw: info });
  const pet = await keyed
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize({ height: 230, fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer({ resolveWithObject: true });

  const left = 768 - Math.round(pet.info.width / 2);
  const top = 835 - pet.info.height;

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: pet.data, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(JSON.stringify({ output, left, top, width: pet.info.width, height: pet.info.height, sourceBounds: { minX, minY, maxX, maxY } }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
