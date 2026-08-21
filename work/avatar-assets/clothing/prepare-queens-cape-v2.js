const path = require('path');
const sharp = require('sharp');
const source = 'C:\\Users\\momin\\AppData\\Local\\Temp\\codex-clipboard-82443727-017c-45b8-bfc9-e8d5bfe1d15d.png';
const output = path.resolve(__dirname, 'queens-cape.png');

function isChecker(data, o) { const r=data[o],g=data[o+1],b=data[o+2]; return r>=225&&g>=225&&b>=225&&Math.max(r,g,b)-Math.min(r,g,b)<=14; }
async function main() {
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true}); const {width,height}=info;
  const seen=new Uint8Array(width*height), q=[];
  const add=(x,y)=>{const i=y*width+x;if(!seen[i]&&isChecker(data,i*4)){seen[i]=1;q.push(i)}};
  for(let x=0;x<width;x++){add(x,0);add(x,height-1)} for(let y=1;y<height-1;y++){add(0,y);add(width-1,y)}
  for(let p=0;p<q.length;p++){const i=q[p],x=i%width,y=(i-x)/width;if(x)add(x-1,y);if(x+1<width)add(x+1,y);if(y)add(x,y-1);if(y+1<height)add(x,y+1)}
  let l=width,t=height,r=-1,b=-1;for(let i=0;i<width*height;i++){if(seen[i])data[i*4+3]=0;if(data[i*4+3]>12){const x=i%width,y=(i-x)/width;l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y)}}
  const cape=await sharp(data,{raw:{width,height,channels:4}}).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize({width:1024,height:800,fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  await sharp({create:{width:1024,height:1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:cape,left:0,top:570}]).png().toFile(output);
  console.log(JSON.stringify({output,sourceBounds:{left:l,top:t,width:r-l+1,height:b-t+1}}));
}
main().catch(e=>{console.error(e);process.exit(1)});
