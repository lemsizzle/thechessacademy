const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const source = "C:/Users/momin/AppData/Local/Temp/codex-clipboard-d78bd687-94c8-48f9-979e-c7dce956c4e7.png";
const outputDir = "work/avatar-assets/accessories";
const output = path.join(outputDir, "golden-knight-pet.png");

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  // Source alpha bounds: x 308–722, y 410–1032. Crop only transparent padding.
  const pet = await sharp(source)
    .extract({ left: 308, top: 410, width: 415, height: 623 })
    .resize({ height: 230, fit: "inside", withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer({ resolveWithObject: true });

  // Place the pedestal at shoulder height on the viewer's right side.
  const left = 768 - Math.round(pet.info.width / 2);
  const top = 835 - pet.info.height;
  const transparentCanvas = {
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  };

  await sharp(transparentCanvas)
    .composite([{ input: pet.data, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  const metadata = await sharp(output).metadata();
  console.log(JSON.stringify({ output, left, top, petWidth: pet.info.width, petHeight: pet.info.height, metadata }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
