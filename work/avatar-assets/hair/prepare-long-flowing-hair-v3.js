const path = require("path");
const sharp = require("sharp");

const source = path.join(__dirname, "long-flowing-hair-v6-source.png");
const output = path.join(__dirname, "long-flowing-hair.png");
const preview = path.join(__dirname, "long-flowing-hair-v10-preview.png");

const placement = { left: 102, top: 135, width: 820, height: 700 };

function isLightNeutral(r, g, b) {
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  return high >= 160 && high - low <= 50;
}

function isDarkNeutral(r, g, b) {
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  return high <= 28 && high - low <= 16;
}

function removeFlattenedCheckerboard(data, info) {
  let clearedPixels = 0;

  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (!isLightNeutral(r, g, b) && !isDarkNeutral(r, g, b)) continue;
    data[offset + 3] = 0;
    clearedPixels += 1;
  }

  return clearedPixels;
}

function alphaBounds(data, info) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) throw new Error("The source image contains no visible hair pixels.");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function avatarPreviewSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="8" fill="#081226"/>
      <circle cx="80" cy="33" r="55" fill="#0e2941" opacity=".72"/>
      <path d="M31 160v-28q5-25 36-25l13 14 13-14q31 0 36 25v28z" fill="#c98b68"/>
      <path d="M48 160v-29q4-18 19-22l13 15 13-15q15 4 19 22v29z" fill="#e2e8f0"/>
      <path d="M62 112l18 12 18-12" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
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
  const clearedBackgroundPixels = removeFlattenedCheckerboard(data, info);
  const bounds = alphaBounds(data, info);
  const hair = await sharp(data, { raw: info })
    .extract(bounds)
    .resize({ width: placement.width, height: placement.height, fit: "fill", kernel: sharp.kernel.lanczos3 })
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
    .composite([{ input: hair, left: placement.left, top: placement.top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await sharp(canvas).toFile(output);
  await sharp(avatarPreviewSvg())
    .composite([{ input: canvas, left: 0, top: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(preview);

  console.log(JSON.stringify({ source, output, preview, bounds, clearedBackgroundPixels, placement }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
