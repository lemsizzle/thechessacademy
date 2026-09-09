const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
const {createClient}=require('@supabase/supabase-js');
async function main(){
 const entries=JSON.parse(await fs.readFile(path.join(__dirname,'manifest.json'),'utf8'));
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const results=[];
 for(const e of entries){
  const file=await fs.readFile(path.join(__dirname,e.slug+'.webp'));
  const meta=await sharp(file).metadata();
  if(meta.width!==1024||meta.height!==1024)throw new Error('Invalid badge dimensions');
  const key='chaos-mastery-20260909/'+e.slug+'-v1.webp';
  const {error}=await db.storage.from('badge-art').upload(key,file,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});
  if(error&&!/already exists|duplicate/i.test(error.message))throw error;
  const url=db.storage.from('badge-art').getPublicUrl(key).data.publicUrl;
  const response=await fetch(url);
  if(!response.ok||!Buffer.from(await response.arrayBuffer()).equals(file))throw new Error('Public image verification failed');
  const {data:badge,error:updateError}=await db.from('badges').update({art_image_url:url,final_image_url:url,generation_status:'selected',generation_error:null}).eq('id',e.id).select('id,name,tier,xp_value,unlock_requirement,art_image_url').single();
  if(updateError)throw updateError;
  results.push(badge);console.log('Verified '+badge.name);
 }
 await fs.writeFile(path.join(__dirname,'published.json'),JSON.stringify(results,null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
