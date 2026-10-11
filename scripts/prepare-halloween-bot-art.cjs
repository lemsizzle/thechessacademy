// Resize/export only; source portraits were generated with built-in imagegen.
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const sourceDir = process.argv[2];
if (!sourceDir) throw new Error('Pass the generated image directory.');
const sources = {
  pumpkin: 'exec-376455c5-9db3-4495-9ba0-04efb4728ef1.png',
  ghost: 'exec-b8e00b2c-811e-4b74-9fd9-5753cfb3dabc.png',
  vampire: 'exec-0ee81a80-a7dd-461f-b411-f31ec7e2ee93.png',
  witch: 'exec-ea1f0471-30b0-4d74-9f10-159bbe7aa784.png',
  werewolf: 'exec-70655aa1-ef9e-4de3-ac4b-a059263d889e.png'
};
(async () => {
  const output = path.resolve('public/bots/halloween');
  await fs.mkdir(output, { recursive: true });
  await fs.mkdir('work/halloween', { recursive: true });
  const previews = [];
  for (const [name, file] of Object.entries(sources)) {
    const source = path.join(sourceDir, file);
    const metadata = await sharp(source).metadata();
    if (!metadata.hasAlpha) throw new Error(`${name} is not transparent.`);
    const dest = path.join(output, `${name}.webp`);
    await sharp(source).resize(480,480,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:86}).toFile(dest);
    previews.push({ input: await sharp(dest).resize(240,240).png().toBuffer(), left:(previews.length%3)*240, top:Math.floor(previews.length/3)*240 });
    console.log(`${name}: ${(await fs.stat(dest)).size} bytes, alpha preserved`);
  }
  await sharp({create:{width:720,height:480,channels:4,background:'#111827'}}).composite(previews).png().toFile('work/halloween/portraits.png');
})();
