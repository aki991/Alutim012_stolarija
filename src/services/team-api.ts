import type { Job } from '../models';
import { getSupabase } from './supabase';

export type TeamMember={id:string;name:string;role:'manager'|'worker';active:boolean};
export type TeamJob={id:string;data:Job;assigned_to:string|null;assigned_by:string|null;revision:number};
export type TeamMessage={id:string;job_id:string;sender_id:string|null;sender_name:string;body:string;created_at:string};
export type TeamConversation=TeamMessage&{job_name:string;unread:boolean};
export type TeamNotification={
 id:string;job_id:string;kind:'assignment'|'status';actor_name:string;job_name:string;
 body:string;created_at:string;read_at:string|null;
};

export class TeamRequestError extends Error {
 constructor(message:string,readonly code?:string){super(message);}
}

function check<T>({data,error}:{data:T;error:{message:string;code?:string}|null}):T {
 if(error)throw new TeamRequestError(error.message,error.code);
 return data;
}

function checkedJob(response:{data:TeamJob|null;error:{message:string;code?:string}|null}):TeamJob {
 const row=check(response);
 if(!row)throw new TeamRequestError('Baza nije vratila sačuvan posao.');
 return row;
}

export async function fetchTeamMember(id:string):Promise<TeamMember|null>{
 return check(await getSupabase().from('field_team_members').select('id,name,role,active').eq('id',id).maybeSingle());
}

export async function fetchTeamWorkers():Promise<TeamMember[]>{
 return check(await getSupabase().from('field_team_members').select('id,name,role,active').eq('role','worker').eq('active',true).order('name'))??[];
}

export async function fetchTeamJobs(known:ReadonlyMap<string,TeamJob>):Promise<TeamJob[]>{
 const api=getSupabase(),rows:TeamJob[]=[];
 const pageSize=100;
 for(let offset=0;;offset+=pageSize){
  const versions=check(await api.from('field_team_visible_jobs').select('id,revision').order('id').range(offset,offset+pageSize-1))??[];
  const changed=versions.filter(row=>known.get(row.id)?.revision!==row.revision).map(row=>row.id);
  const fetched:TeamJob[]=changed.length?check(await api.from('field_team_visible_jobs').select('id,data,assigned_to,assigned_by,revision').in('id',changed))??[]:[];
  for(const row of versions){
   const result=known.get(row.id)?.revision===row.revision?known.get(row.id):fetched.find(job=>job.id===row.id);
   if(result)rows.push(result);
  }
  if(versions.length<pageSize)return rows;
 }
}

export async function createTeamJob(job:Job,assignee?:string,message?:string):Promise<TeamJob>{
 return checkedJob(await getSupabase().rpc('field_team_create_job',{p_job:job,p_assignee:assignee??null,p_message:message??''}).single<TeamJob>());
}

export async function updateTeamJob(id:string,patch:Partial<Job>,expected:Partial<Job>):Promise<TeamJob>{
 return checkedJob(await getSupabase().rpc('field_team_update_job',{p_id:id,p_patch:patch,p_expected:expected}).single<TeamJob>());
}

export async function deleteTeamJob(job:Job){
 check(await getSupabase().rpc('field_team_delete_job',{p_id:job.id,p_expected:job}));
}

export async function assignTeamJob(id:string,assignee:string,message:string):Promise<TeamJob>{
 return checkedJob(await getSupabase().rpc('field_team_assign',{p_id:id,p_assignee:assignee,p_message:message}).single<TeamJob>());
}

export async function fetchTeamMessages(id:string):Promise<TeamMessage[]>{
 const rows=check(await getSupabase().from('field_team_messages').select('id,job_id,sender_id,sender_name,body,created_at')
  .eq('job_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100))??[];
 return rows.reverse();
}

export async function sendTeamMessage(id:string,messageId:string,body:string){
 check(await getSupabase().rpc('field_team_send_message',{p_id:id,p_message_id:messageId,p_body:body}));
}

export async function fetchTeamNotifications():Promise<TeamNotification[]>{
 return check(await getSupabase().from('field_team_notifications').select('id,job_id,kind,actor_name,job_name,body,created_at,read_at')
  .neq('kind','message').order('created_at',{ascending:false}).limit(100))??[];
}

export async function markTeamNotificationRead(id:string){
 check(await getSupabase().rpc('field_team_read_notification',{p_id:id}));
}

export async function fetchTeamConversations():Promise<TeamConversation[]> {
 return check(await getSupabase().from('field_team_message_inbox').select('id,job_id,sender_id,sender_name,body,created_at,job_name,unread')
  .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100))??[];
}

export async function markTeamMessagesRead(jobId:string,messageId:string) {
 check(await getSupabase().rpc('field_team_read_messages',{p_job_id:jobId,p_message_id:messageId}));
}
