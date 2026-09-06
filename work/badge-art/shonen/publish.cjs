const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const {createClient} = require('@supabase/supabase-js');
const root = __dirname;
async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
  const {data:before,error} = await s.from('badges').select('*').in('id',manifest.map(x=>x.id));
  if(error) throw error;
  if(before.length!==manifest.length) throw new Error('Badge inventory mismatch');
  const backup = path.join(root,'before.json');
  try { await fs.writeFile(backup,JSON.stringify(before,null,2),{flag:'wx'}); } catch(e) { if(e.code!=='EEXIST') throw e; }
  const {data:buckets,error:be}=await s.storage.listBuckets(); if(be) throw be;
  if(!buckets.some(x=>x.name==='badge-art')) {const {error}=await s.storage.createBucket('badge-art',{public:true,fileSizeLimit:5242880,allowedMimeTypes:['image/png','image/webp','image/jpeg']});if(error)throw error;}
  const results=[];
  for(const entry of manifest) {
    const file=await fs.readFile(path.join(root,entry.slug+'.webp'));
    const objectPath='shonen-20260906/'+entry.id+'/'+entry.slug+'-v1.webp';
    const {error:ue}=await s.storage.from('badge-art').upload(objectPath,file,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});
    if(ue && !/already exists|duplicate/i.test(ue.message)) throw ue;
    const url=s.storage.from('badge-art').getPublicUrl(objectPath).data.publicUrl;
    const response=await fetch(url);if(!response.ok)throw new Error('Asset failed '+entry.slug);
    const bytes=Buffer.from(await response.arrayBuffer());const meta=await sharp(bytes).metadata();
    if(meta.width!==1024||meta.height!==1024||!bytes.equals(file))throw new Error('Asset differs '+entry.slug);
    const {data:updated,error:we}=await s.from('badges').update({art_image_url:url,final_image_url:url,generation_status:'selected',generation_error:null}).eq('id',entry.id).select('*').single();
    if(we)throw we;
    const old=before.find(x=>x.id===entry.id);
    for(const field of ['name','description','category','tier','xp_value','unlock_requirement']) if(updated[field]!==old[field])throw new Error('Unexpected change '+field);
    results.push({name:updated.name,id:entry.id,url});console.log('Verified '+entry.name);
  }
  await fs.writeFile(path.join(root,'published.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({published:results.length}));
}
main().catch(e=>{console.error(e);process.exit(1)});
