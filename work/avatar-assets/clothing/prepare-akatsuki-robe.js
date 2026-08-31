const path = require("node:path");
const sharp = require("sharp");

const source = path.join(__dirname, "akatsuki-robe-v7-source.png");
const output = path.join(__dirname, "akatsuki-robe.png");
const preview = path.join(__dirname, "akatsuki-robe-preview.png");
const placement = { left: 102, top: 540, width: 820, height: 820 };

function isLightNeutral(r, g, b) {
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  return high >= 185 && high - low <= 24;
}

function removeConnectedCheckerboard(data, info) {
  const seen = new Uint8Array(info.width * info.height);
  const queue = [];
  const add = (x, y) => {
    const index = y * info.width + x;
    const offset = index * 4;
    if (seen[index] || !isLightNeutral(data[offset], data[offset + 1], data[offset + 2])) return;
    seen[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < info.width; x += 1) {
    add(x, 0);
    add(x, info.height - 1);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    add(0, y);
    add(info.width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    if (x > 0) add(x - 1, y);
    if (x + 1 < info.width) add(x + 1, y);
    if (y > 0) add(x, y - 1);
    if (y + 1 < info.height) add(x, y + 1);
  }

  for (let index = 0; index < seen.length; index += 1) {
    if (seen[index]) data[index * 4 + 3] = 0;
  }
}

function avatarPreviewSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="8" fill="#081226"/>
      <circle cx="80" cy="33" r="55" fill="#0e2941" opacity=".72"/>
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
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removeConnectedCheckerboard(data, info);

  const garment = await sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({
      width: placement.width,
      height: placement.height,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  const canvas = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: garment, left: placement.left, top: placement.top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await sharp(canvas).toFile(output);
  await sharp(avatarPreviewSvg())
    .composite([{ input: canvas, left: 0, top: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(preview);

  const metadata = await sharp(output).metadata();
  if (metadata.width !== 1024 || metadata.height !== 1024 || !metadata.hasAlpha) {
    throw new Error("Akatsuki Robe must be a transparent 1024x1024 PNG.");
  }

  console.log(JSON.stringify({ source, output, preview, placement }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
