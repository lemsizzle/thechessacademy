const path = require('path');
const sharp = require('sharp');

const source = path.resolve(__dirname, 'neon-pawn-shades-cutout.png');
const output = path.resolve(__dirname, 'neon-pawn-shades.png');

async function alphaBounds(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) throw new Error('No opaque accessory pixels found after background removal.');
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main() {
  const bounds = await alphaBounds(source);
  const cropped = await sharp(source)
    .extract(bounds)
    .resize({ width: 680, height: 230, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Front-facing avatars place the ears outside the original temple tips.
  // These extensions carry the neon arms across each ear, with a small downward
  // hook so the glasses read as worn rather than floating.
  const extendedArms = Buffer.from(`
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="M336 474 H154 Q132 474 126 495 L120 516" fill="none" stroke="#18331a" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M336 474 H154 Q132 474 126 495 L120 516" fill="none" stroke="#8dff00" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
      <path d="M688 474 H870 Q892 474 898 495 L904 516" fill="none" stroke="#18331a" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M688 474 H870 Q892 474 898 495 L904 516" fill="none" stroke="#8dff00" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
    </svg>
  `);
  const removeOriginalArmTips = Buffer.from(`
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <rect x="170" y="435" width="166" height="125" fill="white"/>
      <rect x="688" y="435" width="166" height="125" fill="white"/>
    </svg>
  `);

  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: cropped, left: 172, top: 340 },
      { input: removeOriginalArmTips, blend: 'dest-out' },
      { input: extendedArms },
    ])
    .png()
    .toFile(output);

  const finalBounds = await alphaBounds(output);
  console.log(JSON.stringify({ output, finalBounds }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
