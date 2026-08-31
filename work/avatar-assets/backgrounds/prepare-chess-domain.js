const path = require("node:path");
const sharp = require("sharp");

const source = path.join(__dirname, "chess-domain-source.png");
const output = path.join(__dirname, "chess-domain.png");
const preview = path.join(__dirname, "chess-domain-preview.png");

function avatarPreviewSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 160 160">
      <path d="M31 160v-28q5-25 36-25l13 14 13-14q31 0 36 25v28z" fill="#c98b68"/>
      <path d="M48 160v-29q4-18 19-22l13 15 13-15q15 4 19 22v29z" fill="#e2e8f0"/>
      <circle cx="38" cy="75" r="10" fill="#c98b68"/>
      <circle cx="122" cy="75" r="10" fill="#c98b68"/>
      <rect x="67" y="101" width="26" height="28" rx="10" fill="#c98b68"/>
      <circle cx="80" cy="72" r="43" fill="#c98b68"/>
      <ellipse cx="64" cy="70" rx="8" ry="7" fill="white"/>
      <ellipse cx="96" cy="70" rx="8" ry="7" fill="white"/>
      <circle cx="65" cy="71" r="4" fill="#172554"/>
      <circle cx="95" cy="71" r="4" fill="#172554"/>
      <circle cx="66" cy="69" r="1.5" fill="white"/>
      <circle cx="96" cy="69" r="1.5" fill="white"/>
      <path d="M67 91q13 14 27 0" fill="#fff" stroke="#9f1239" stroke-width="4" stroke-linejoin="round"/>
    </svg>
  `);
}

async function main() {
  const background = await sharp(source)
    .resize(1024, 1024, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await sharp(background).toFile(output);
  await sharp(background)
    .composite([{ input: avatarPreviewSvg(), left: 0, top: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(preview);

  const metadata = await sharp(output).metadata();
  if (metadata.width !== 1024 || metadata.height !== 1024 || metadata.format !== "png") {
    throw new Error("Chess Domain must be a 1024x1024 PNG.");
  }

  console.log(JSON.stringify({ source, output, preview, width: metadata.width, height: metadata.height }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
