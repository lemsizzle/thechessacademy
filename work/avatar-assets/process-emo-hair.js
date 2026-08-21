const sharp = require("sharp");

async function main() {
  const input = "work/avatar-assets/hair/emo-hair-chroma.png";
  const output = "work/avatar-assets/hair/emo-hair.png";
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const distance = Math.sqrt((red - 255) ** 2 + green ** 2 + (blue - 255) ** 2);
    const alpha = distance <= 60 ? 0 : distance >= 180 ? 255 : Math.round(((distance - 60) / 120) * 255);
    if (alpha < 230) {
      data[i] = Math.min(red, green + 24);
      data[i + 2] = Math.min(blue, green + 72);
    }
    data[i + 3] = alpha;
  }

  await sharp(data, { raw: info }).resize(1024, 1024, { fit: "fill" }).png().toFile(output);
  console.log(await sharp(output).metadata());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
