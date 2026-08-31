const sharp = require('sharp');

const source = 'work/avatar-assets/aura/super-saiyan-source.png';
const output = 'work/avatar-assets/aura/super-saiyan.png';
const expandedSize = 1240;
const cropOffset = Math.floor((expandedSize - 1024) / 2);

async function main() {
  await sharp(source)
    .ensureAlpha()
    // Push the energy beyond every canvas edge so the aura reads as a
    // full-height surround instead of a backdrop centered behind the head.
    .resize({ width: expandedSize, height: expandedSize, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .extract({ left: cropOffset, top: cropOffset, width: 1024, height: 1024 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(JSON.stringify({ output, width: 1024, height: 1024 }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
