const path = require('path');
const sharp = require('sharp');

const source = 'C:\\Users\\momin\\AppData\\Local\\Temp\\codex-clipboard-8c015778-b31a-4b82-a6df-04e93a4bda5b.png';
const output = path.resolve(__dirname, 'mathematicians-board.png');

async function main() {
  await sharp(source)
    .resize(1024, 1024, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9, palette: true, quality: 90, colours: 256, dither: 1 })
    .toFile(output);
  console.log(output);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
