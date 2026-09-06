const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
async function main(){
 const entries=JSON.parse(await fs.readFile(path.join(__dirname,'manifest.json'),'utf8'));
 const tiles=[];
 for(let i=0;i<entries.length;i++){
  const e=entries[i];
  await fs.copyFile(e.source,path.join(__dirname,e.slug+'-source.png'));
  const output=path.join(__dirname,e.slug+'.webp');
  await sharp(e.source).resize(1024,1024,{fit:'contain',background:'#080f20'}).flatten({background:'#080f20'}).webp({quality:92}).toFile(output);
  const tile=await sharp(output).resize(240,240).toBuffer();
  const left=(i%4)*260,top=Math.floor(i/4)*282;
  tiles.push({input:tile,left:left+10,top});
  const label=Buffer.from('<svg width="260" height="32"><text x="130" y="20" text-anchor="middle" font-family="sans-serif" font-size="14" fill="white">'+e.name+'</text></svg>');
  tiles.push({input:label,left,top:top+242});
 }
 await sharp({create:{width:1040,height:Math.ceil(entries.length/4)*282,channels:3,background:'#080f20'}}).composite(tiles).png().toFile(path.join(__dirname,'collection-preview.png'));
 console.log('Prepared '+entries.length+' badges');
}
main().catch(e=>{console.error(e);process.exit(1)});
