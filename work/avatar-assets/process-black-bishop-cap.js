const sharp = require("sharp");

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  throw new Error("Usage: node process-black-bishop-cap.js <input> <output>");
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

async function main() {
  const { data, info } = await sharp(inputPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const sourceOffset = pixel * 3;
    const targetOffset = pixel * 4;
    const red = data[sourceOffset];
    const green = data[sourceOffset + 1];
    const blue = data[sourceOffset + 2];
    const keyDistance = Math.sqrt((red * red) + ((255 - green) ** 2) + (blue * blue));
    const alpha = Math.round(clamp((keyDistance - 55) / 105, 0, 1) * 255);
    const neutralEdge = Math.max(red, blue);

    rgba[targetOffset] = red;
    rgba[targetOffset + 1] = green > neutralEdge ? neutralEdge : green;
    rgba[targetOffset + 2] = blue;
    rgba[targetOffset + 3] = alpha;

    if (alpha > 16) {
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) throw new Error("No opaque cap pixels found after chroma removal.");

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const targetWidth = Math.min(540, Math.floor(442 * (cropWidth / cropHeight)));
  const targetHeight = Math.round(cropHeight * (targetWidth / cropWidth));
  const targetLeft = Math.round((1024 - targetWidth) / 2);
  const targetTop = Math.max(0, 442 - targetHeight);

  const fittedCap = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(targetWidth, targetHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  const result = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: fittedCap, left: targetLeft, top: targetTop }])
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPath);

  console.log(JSON.stringify({
    output: outputPath,
    sourceBounds: { left, top, right, bottom, width: cropWidth, height: cropHeight },
    placedBounds: { left: targetLeft, top: targetTop, width: targetWidth, height: targetHeight },
    result
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
