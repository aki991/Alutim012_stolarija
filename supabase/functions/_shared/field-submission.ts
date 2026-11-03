import type { SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'field-specifications';
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status:number, body:object) => new Response(JSON.stringify(body), { status, headers: {...cors, 'Content-Type':'application/json', 'Cache-Control':'no-store'} });
const hash = async(bytes:BufferSource) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)), b=>b.toString(16).padStart(2,'0')).join('');
const validText = (value:unknown,max:number) => typeof value==='string'&&value.length<=max;

export function createSubmissionHandler({getAdmin,rateSalt}:{getAdmin:()=>SupabaseClient;rateSalt:string}){
 return async (request:Request):Promise<Response> => {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return json(405,{error:'Dozvoljeno je samo slanje dokumenta.'});
  try{
   const admin=getAdmin();
   const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
   const ipHash=await hash(new TextEncoder().encode(rateSalt+':'+ip));
   const quota=await admin.rpc('claim_field_submission_slot',{ip_hash:ipHash});
   if(quota.error)return json(503,{error:'Prijem dokumenata nije podešen. Proverite Supabase migraciju.'});
   if(!quota.data)return json(429,{error:'Previše slanja. Sačekajte nekoliko minuta i pokušajte ponovo.'});
   if(Number(request.headers.get('content-length'))>MAX_PDF_BYTES+1024*1024)return json(413,{error:'Dokument je veći od 20 MB.'});
   let form:FormData;
   try{form=await request.formData();}catch{return json(400,{error:'Neispravan zahtev za slanje.'});}
   const file=form.get('file');
   if(!(file instanceof File)||file.type!=='application/pdf'||file.size<5)return json(400,{error:'Potreban je PDF dokument.'});
   if(file.size>MAX_PDF_BYTES)return json(413,{error:'Dokument je veći od 20 MB.'});
   let m:Record<string,unknown>;
   try{const raw=form.get('metadata');if(typeof raw!=='string'||raw.length>4096)throw Error();m=JSON.parse(raw);if(!m||typeof m!=='object')throw Error();}catch{return json(400,{error:'Neispravni podaci specifikacije.'});}
   if(!validText(m.id,36)||!/^\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b$/i.test(String(m.id))||!validText(m.job_id,100)||!m.job_id||!validText(m.customer_name,100)||!String(m.customer_name).trim()||!validText(m.technician,100)||!validText(m.job_updated_at,100)||!Number.isInteger(m.position_count)||Number(m.position_count)<1||Number(m.position_count)>10000||typeof m.total_amount!=='number'||!Number.isFinite(m.total_amount)||m.total_amount<0||typeof m.has_unpriced!=='boolean')return json(400,{error:'Neispravni podaci specifikacije.'});
   const bytes=await file.arrayBuffer();
   if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')return json(400,{error:'Datoteka nije PDF dokument.'});
   const sha=await hash(bytes),id=String(m.id),storagePath=`${id}/specifikacija.pdf`;
   const existing=await admin.from('field_specifications').select('id,created_at,content_sha256').eq('id',id).maybeSingle();
   if(existing.error)return json(503,{error:'Baza trenutno nije dostupna. Pokušajte ponovo.'});
   if(existing.data){
    if(existing.data.content_sha256!==sha)return json(409,{error:'Oznaka slanja već pripada drugom dokumentu.'});
    return json(200,{id,created_at:existing.data.created_at,status:'received',already_received:true});
   }
   const storage=admin.storage.from(BUCKET);
   const upload=await storage.upload(storagePath,bytes,{contentType:'application/pdf',upsert:false});
   if(upload.error){
    // An upload may have succeeded before the previous connection was lost.
    // Reuse only the exact same PDF; never overwrite a document.
    if(!['409','Duplicate'].includes(String('statusCode' in upload.error?upload.error.statusCode:''))&&!/already exists|duplicate/i.test(upload.error.message))return json(503,{error:'PDF nije sačuvan. Pokušajte ponovo.'});
    const stored=await storage.download(storagePath);
    if(stored.error||!stored.data||await hash(await stored.data.arrayBuffer())!==sha)return json(409,{error:'Dokument sa ovom oznakom nije moguće ponoviti.'});
   }
   const inserted=await admin.from('field_specifications').insert({id,job_id:m.job_id,job_updated_at:m.job_updated_at,customer_name:m.customer_name,technician:m.technician,position_count:m.position_count,total_amount:m.total_amount,has_unpriced:m.has_unpriced,bucket_id:BUCKET,storage_path:storagePath,file_name:`${String(m.job_id).replace(/[^a-zA-Z0-9_-]/g,'_')}-specifikacija.pdf`,file_size:file.size,content_sha256:sha}).select('id,created_at').single();
   if(inserted.error){
    const check=await admin.from('field_specifications').select('id,created_at,content_sha256').eq('id',id).maybeSingle();
    if(check.error||!check.data||check.data.content_sha256!==sha)return json(503,{error:'Prijem još nije potvrđen. Pokušajte ponovo istim dugmetom.'});
    return json(200,{id,created_at:check.data.created_at,status:'received',already_received:true});
   }
   return json(201,{id,created_at:inserted.data.created_at,status:'received'});
  }catch{
   return json(503,{error:'Slanje nije potvrđeno. Proverite vezu i pokušajte ponovo.'});
  }
 };
}
