const sharp = require('sharp');

const output = 'work/avatar-assets/facial-hair/boy-who-lived-scar.png';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M428 282 L398 329 L422 325 L397 384" stroke="#3f171c" stroke-width="19" opacity="0.48" transform="translate(3 4)"/>
    <path d="M428 282 L398 329 L422 325 L397 384" stroke="#60232b" stroke-width="16"/>
    <path d="M428 282 L398 329 L422 325 L397 384" stroke="#a4484b" stroke-width="8" opacity="0.95"/>
    <path d="M424 291 L406 322" stroke="#e5a19c" stroke-width="3" opacity="0.75"/>
    <path d="M416 338 L403 369" stroke="#e5a19c" stroke-width="3" opacity="0.55"/>
  </g>
</svg>`;

async function main() {
  await sharp(Buffer.from(svg))
    .ensureAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);
  console.log(JSON.stringify({ output, width: 1024, height: 1024 }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
