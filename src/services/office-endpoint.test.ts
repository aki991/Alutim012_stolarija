import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSubmissionHandler, MAX_PDF_BYTES } from '../../supabase/functions/_shared/field-submission';

function fixture(){
 const files=new Map<string,Blob>(),rows=new Map<string,any>();
 const flags={quota:true,quotaError:false,uploadError:false,insertError:false};
 const storage={
  upload:async(path:string,data:ArrayBuffer)=>{if(flags.uploadError)return {error:{message:'offline'}};if(files.has(path))return {error:{message:'already exists',statusCode:'409'}};files.set(path,new Blob([data]));return {error:null};},
  download:async(path:string)=>({data:files.get(path),error:null}),
 };
 const admin={rpc:async()=>({data:flags.quota,error:flags.quotaError?{}:null}),storage:{from:()=>storage},from:()=>({
  select:()=>({eq:(_:string,id:string)=>({maybeSingle:async()=>({data:rows.get(id)??null,error:null})})}),
  insert:(row:any)=>({select:()=>({single:async()=>{if(flags.insertError)return {error:{message:'connection lost'}};rows.set(row.id,{...row,created_at:'2026-11-03T12:00:00Z'});return {data:rows.get(row.id),error:null};}})}),
 })};
 return {files,rows,flags,handler:createSubmissionHandler({getAdmin:()=>admin as unknown as SupabaseClient,rateSalt:'server-secret'})};
}
const metadata=()=>({id:crypto.randomUUID(),job_id:'AT-TEST',job_updated_at:'2026-11-03',customer_name:'Kupac',technician:'Majstor',position_count:2,total_amount:600,has_unpriced:false});
function request(m=metadata(),file=new File(['%PDF-1.7 test'],'spec.pdf',{type:'application/pdf'})){
 const body=new FormData();body.append('file',file);body.append('metadata',JSON.stringify(m));return new Request('https://example.test',{method:'POST',body});
}
describe('Javni endpoint za privatnu kancelarijsku specifikaciju',()=>{
 it('podržava CORS, odbija druge metode i ne zahteva prijavu',async()=>{const {handler}=fixture();expect((await handler(new Request('https://test',{method:'OPTIONS'}))).status).toBe(204);expect((await handler(new Request('https://test'))).status).toBe(405);expect((await handler(request())).status).toBe(201);});
 it('čuva PDF pa potpun zapis sa privatnom putanjom',async()=>{const {handler,rows,files}=fixture(),m=metadata();const r=await handler(request(m));expect(r.status).toBe(201);expect(rows.get(m.id)).toMatchObject({...m,bucket_id:'field-specifications',storage_path:`${m.id}/specifikacija.pdf`});expect(files.size).toBe(1);expect(await r.json()).not.toHaveProperty('url');});
 it('ponovljen zahtev ne duplira dokument ili prijem',async()=>{const {handler,rows,files}=fixture(),m=metadata();await handler(request(m));const r=await handler(request(m));expect(r.status).toBe(200);expect(await r.json()).toMatchObject({id:m.id,already_received:true});expect(rows.size).toBe(1);expect(files.size).toBe(1);});
 it('isti ID ne može da prepiše sadržaj dokumenta',async()=>{const {handler,rows}=fixture(),m=metadata();await handler(request(m));const r=await handler(request(m,new File(['%PDF-drugi'],'x.pdf',{type:'application/pdf'})));expect(r.status).toBe(409);expect(rows.size).toBe(1);});
 it('ograničava slanje pre učitavanja fajla',async()=>{const {handler,flags,files}=fixture();flags.quota=false;expect((await handler(request())).status).toBe(429);expect(files.size).toBe(0);});
 it('nedostajuća migracija ne daje lažnu potvrdu',async()=>{const {handler,flags}=fixture();flags.quotaError=true;expect((await handler(request())).status).toBe(503);});
 it('proverava sadržaj i metapodatke pre upisa',async()=>{const {handler,files}=fixture();expect((await handler(request(metadata(),new File(['wrong'],'x.pdf',{type:'application/pdf'})))).status).toBe(400);expect((await handler(request({...metadata(),total_amount:-1}))).status).toBe(400);expect(files.size).toBe(0);});
 it('odbija PDF veći od 20 MB',async()=>{const {handler,files}=fixture();expect((await handler(request(metadata(),new File([new Uint8Array(MAX_PDF_BYTES+1)],'big.pdf',{type:'application/pdf'})))).status).toBe(413);expect(files.size).toBe(0);});
 it('ne upisuje prijem ako upload nije uspeo',async()=>{const {handler,flags,rows}=fixture();flags.uploadError=true;expect((await handler(request())).status).toBe(503);expect(rows.size).toBe(0);});
 it('oporavlja prekid između Storage upisa i upisa u tabelu',async()=>{const {handler,flags,files,rows}=fixture(),m=metadata();flags.insertError=true;expect((await handler(request(m))).status).toBe(503);expect(files.size).toBe(1);expect(rows.size).toBe(0);flags.insertError=false;expect((await handler(request(m))).status).toBe(201);expect(files.size).toBe(1);expect(rows.size).toBe(1);});
});
