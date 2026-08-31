const path = require("node:path");
const sharp = require("sharp");

const source = path.join(__dirname, "domain-expansion-source.png");
const output = path.join(__dirname, "domain-expansion.png");

async function main() {
  await sharp(source)
    .resize(1024, 1024, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  const metadata = await sharp(output).metadata();
  if (metadata.width !== 1024 || metadata.height !== 1024) {
    throw new Error("Domain Expansion must be a 1024x1024 image.");
  }

  console.log(JSON.stringify({ source, output, width: metadata.width, height: metadata.height }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
