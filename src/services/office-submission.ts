import type { Job, Settings } from '../models';
import { calculate } from './calculation';
import { makeDocument } from './documents';

export interface OfficeSubmission {
 signature:string;
 file:File;
 metadata:{id:string;job_id:string;job_updated_at:string;customer_name:string;technician:string;position_count:number;total_amount:number;has_unpriced:boolean};
}
export function submissionSignature(job:Job,settings:Settings){return JSON.stringify({job,settings});}
export async function prepareOfficeSubmission(job:Job,settings:Settings):Promise<OfficeSubmission>{
 const c=settings.showPrices===false?null:calculate(job,settings);
 return {signature:submissionSignature(job,settings),file:await makeDocument(job,settings,'kancelarija'),metadata:{id:crypto.randomUUID(),job_id:job.id,job_updated_at:job.updated,customer_name:job.customer.name,technician:job.technician,position_count:job.positions.length,total_amount:c?Number(c.total.toFixed(2)):0,has_unpriced:c?.hasUnpriced??true}};
}
export async function sendOfficeSubmission(submission:OfficeSubmission){
 if(!navigator.onLine)throw Error('Za slanje u app potreban je internet. Posao ostaje sačuvan na ovom uređaju.');
 const {getSupabase,isSupabaseConfigured}=await import('./supabase');
 if(!isSupabaseConfigured)throw Error('Supabase nije podešen. Unesite URL i javni ključ u podešavanja projekta.');
 if(submission.file.size>20*1024*1024)throw Error('Specifikacija je veća od 20 MB. Smanjite broj ili veličinu fotografija.');
 const body=new FormData();body.append('file',submission.file);body.append('metadata',JSON.stringify(submission.metadata));
 const {data,error}=await getSupabase().functions.invoke('submit-field-specification',{body,timeout:60000});
 if(error){
  let detail='';
  if('context' in error&&error.context instanceof Response){try{const result=await error.context.json();if(typeof result.error==='string')detail=result.error;}catch{/* Use a clear connection/deployment fallback. */}}
  throw Error(detail||'Slanje nije potvrđeno. Proverite internet i da li je Supabase funkcija postavljena, pa pokušajte ponovo.');
 }
 if(data?.status!=='received'||data?.id!==submission.metadata.id)throw Error('Server nije potvrdio prijem specifikacije. Pokušajte ponovo.');
 return data as {id:string;created_at:string;status:'received'};
}
