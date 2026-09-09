const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
async function main(){
 const entries=JSON.parse(await fs.readFile(path.join(__dirname,'manifest.json'),'utf8'));
 const tiles=[];
 for(let i=0;i<entries.length;i++){
  const e=entries[i];
  await fs.copyFile(e.source,path.join(__dirname,e.slug+'-source.png'));
  const output=path.join(__dirname,e.slug+'.webp');
  await sharp(e.source).resize(1024,1024,{fit:'contain',background:'#080f20'}).flatten({background:'#080f20'}).webp({quality:92}).toFile(output);
  tiles.push({input:await sharp(output).resize(256,256).toBuffer(),left:i*256,top:0});
 }
 await sharp({create:{width:1024,height:256,channels:3,background:'#080f20'}}).composite(tiles).png().toFile(path.join(__dirname,'preview.png'));
 console.log('Prepared four Chaos Mastery badges');
}
main().catch(e=>{console.error(e);process.exit(1)});
