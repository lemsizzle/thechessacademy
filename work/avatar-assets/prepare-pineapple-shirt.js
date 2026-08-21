const sharp = require("sharp");

const source = "work/avatar-assets/clothing/pineapple-hawaiian-shirt-chroma.png";
const output = "work/avatar-assets/clothing/pineapple-hawaiian-shirt.png";

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
      const distance = Math.sqrt((red - 255) ** 2 + green ** 2 + (blue - 255) ** 2);
      let alpha = distance <= 80 ? 0 : distance >= 190 ? 255 : Math.round(((distance - 80) / 110) * 255);
      const magentaDominance = Math.min(red - green, blue - green);
      if (magentaDominance > 20) {
        const magentaAlpha = magentaDominance >= 100 ? 0 : Math.round(((100 - magentaDominance) / 80) * 255);
        alpha = Math.min(alpha, magentaAlpha);
      }

      if (alpha < 245) {
        data[offset] = Math.min(red, green + 24);
        data[offset + 2] = Math.min(blue, green + 72);
      }
      data[offset + 3] = alpha;

      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const shirt = await sharp(data, { raw: info })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize(628, 374, { fit: "fill", kernel: sharp.kernel.lanczos3 })
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
    .composite([{ input: shirt, left: 198, top: 650 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(JSON.stringify({ output, canvas: [1024, 1024], placement: { left: 198, top: 650, width: 628, height: 374 }, sourceBounds: { minX, minY, maxX, maxY } }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
