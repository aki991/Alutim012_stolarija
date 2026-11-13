import { create } from 'zustand';
import type { Job, Position, Settings } from './models';
import { catalog, makePosition, uid } from './catalog';
import { defaults } from './services/calculation';
import { parseBackup } from './services/storage';
import { createTeamJob, deleteTeamJob, fetchTeamJobs, updateTeamJob, type TeamJob, type TeamMember } from './services/team-api';
const KEY='alu-tim-teren-v1';
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Belgrade'});
export function emptyJob(technician:string): Job {return {id:'AT-'+new Date().getFullYear()+'-'+uid().slice(0,8).toUpperCase(),customer:{name:'',phone:'',email:'',address:'',building:'Porodična kuća'},date:today(),createdAt:new Date().toISOString(),technician,notes:'',status:'U izradi',positions:[],package:'Standard',discount:0,transport:defaults.prices.transport,extraWork:'',extraCost:0,validity:'15 dana',delivery:'Po dogovoru, nakon tehničke provere',payment:'50% avans, ostatak po montaži',updated:new Date().toISOString()};}
export function jobFromSettings(settings:Settings):Job {
 return {...emptyJob(settings.technician),transport:settings.prices.transport,...settings.documentDefaults};
}
function demoJobs():Job[] {
 const p={...makePosition(),name:'Dnevna soba · dvokrilni prozor',quantity:2,shutter:true,mosquito:true,removal:true,notes:'Proveriti završnu meru nakon skidanja stare obloge.',photos:['/assets/house.jpg'],access:'Prizemlje, pristup iz dvorišta.'};
 const single={...makePosition(catalog[0]),name:'Kuhinja · jednokrilni prozor',width:800,height:1000,removal:true};
 const balcony={...makePosition(catalog[5]),name:'Terasa · balkonska vrata',removal:true,color:'Antracit'};
 return [
 {...emptyJob(defaults.technician),id:'AT-2026-012',customer:{name:'Porodica Petrović',phone:'064 123 4567',email:'petrovic@example.com',address:'Vojvođanska 24, Pančevo',building:'Porodična kuća'},positions:[p,single,balcony],notes:'Zamena stare stolarije u prizemlju. Zaštititi podove pre demontaže.',status:'U izradi'},
 {...emptyJob(defaults.technician),id:'AT-2026-011',customer:{name:'Jovanović d.o.o.',phone:'063 456 7890',email:'office@example.com',address:'Cara Dušana 17, Pančevo',building:'Poslovni prostor'},positions:[{...makePosition(catalog[7]),material:'ALU',color:'Antracit'}],status:'Ponuda',discount:5},
 {...emptyJob(defaults.technician),id:'AT-2026-010',customer:{name:'Milan Zorić',phone:'065 222 3344',email:'',address:'Industrijska zona bb, Pančevo',building:'Poslovni prostor'},positions:[{...makePosition(catalog[3]),material:'ALU'}],status:'Ponuda'},
 {...emptyJob(defaults.technician),id:'AT-2026-009',customer:{name:'Ana Nikolić',phone:'064 333 5566',email:'',address:'Svetog Save 8, Starčevo',building:'Stan'},positions:[makePosition(catalog[0])],status:'Završeno'},
 ];
}
type SaveState='saved'|'dirty'|'error';
interface AppState {
 jobs:Job[];settings:Settings;saveState:SaveState;storageError:string;
 teamMember:TeamMember|null;teamConflict:boolean;teamAssignments:Record<string,string|null>;
 updateJob:(id:string,patch:Partial<Job>,baseline?:Job)=>void;addJob:(job:Job)=>void;deleteJob:(id:string)=>void;duplicateJob:(id:string)=>string;
 updatePosition:(job:string,id:string,patch:Partial<Position>)=>void;setSettings:(patch:Partial<Settings>)=>void;
 importData:(data:unknown)=>void;retrySave:()=>void;
}
export const assignedMeasurement=(state:Pick<AppState,'teamAssignments'>,job:Job)=>job.status==='Merenje'&&Boolean(state.teamAssignments[job.id]);
export const awaitingMeasurements=(state:Pick<AppState,'teamAssignments'|'teamMember'>,job:Job)=>state.teamMember?.role==='manager'&&assignedMeasurement(state,job);
type TeamMutation=
 | {type:'create';job:Job}
 | {type:'update';id:string;patch:Partial<Job>;expected:Partial<Job>;updated:string}
 | {type:'delete';job:Job};
interface TeamWorkspace {
 member:TeamMember; rows:Map<string,TeamJob>; pending:TeamMutation[]; epoch:number;
 running:boolean; refreshing:boolean; conflict:boolean; mutationError:string; connectionError:string; draftError:string;
}
let initial:{jobs:Job[];settings:Settings}={jobs:demoJobs(),settings:defaults},initialError='';
try {const raw=localStorage.getItem(KEY);if(raw)initial=parseBackup(JSON.parse(raw));}catch {initialError='Lokalni podaci nisu dostupni ili su oštećeni. Prikazani su demonstracioni podaci.';}
let workspace:TeamWorkspace|undefined,localJobs=initial.jobs;
export const useStore=create<AppState>((set,get)=>({
 ...initial,saveState:initialError?'error':'saved',storageError:initialError,
 teamMember:null,teamConflict:false,teamAssignments:{},
 updateJob:(id,patch,baseline)=>{
  if(workspace){
   const job=get().jobs.find(j=>j.id===id);
   if(!job)return;
   const previous=baseline??job;
   const fields=(Object.keys(patch) as (keyof Job)[]).filter(key=>key!=='id'&&key!=='updated'&&patch[key]!==undefined&&JSON.stringify(patch[key])!==JSON.stringify(previous[key]));
   if(!fields.length)return;
   enqueue({type:'update',id,patch:Object.fromEntries(fields.map(key=>[key,patch[key]])),
    expected:Object.fromEntries(fields.map(key=>[key,previous[key]])),updated:new Date().toISOString()});
   return;
  }
  if(baseline)patch=Object.fromEntries((Object.keys(patch) as (keyof Job)[]).filter(key=>JSON.stringify(patch[key])!==JSON.stringify(baseline[key])).map(key=>[key,patch[key]]));
  set(s=>({jobs:s.jobs.map(j=>j.id===id?{...j,...patch,updated:new Date().toISOString()}:j),saveState:'dirty'}));
 },
 addJob:job=>{
  if(workspace){enqueue({type:'create',job:{...job,technician:workspace.member.name,status:workspace.member.role==='worker'?'Merenje':job.status}});return;}
  set(s=>({jobs:[job,...s.jobs],saveState:'dirty'}));
 },
 deleteJob:id=>{
  if(workspace){
   const job=get().jobs.find(j=>j.id===id);
   if(job&&workspace.member.role==='manager')enqueue({type:'delete',job});
   return;
  }
  set(s=>({jobs:s.jobs.filter(j=>j.id!==id),saveState:'dirty'}));
 },
 duplicateJob:id=>{const j=get().jobs.find(j=>j.id===id)!;const copy={...structuredClone(j),id:emptyJob(get().settings.technician).id,customer:{...j.customer,name:j.customer.name+' (kopija)'},status:'U izradi' as const,createdAt:new Date().toISOString(),updated:new Date().toISOString(),positions:j.positions.map(p=>({...structuredClone(p),id:uid()}))};get().addJob(copy);return copy.id;},
 updatePosition:(job,id,patch)=>{const j=get().jobs.find(j=>j.id===job);if(j)get().updateJob(job,{positions:j.positions.map(p=>p.id===id?{...p,...patch}:p)});},
 setSettings:patch=>set(s=>({settings:{...s.settings,...patch},saveState:'dirty'})),
 importData:data=>{
  const d=parseBackup(data);
  if(workspace)return;
  set({jobs:d.jobs,settings:d.settings,saveState:'dirty'});
 },
 retrySave:()=>{if(workspace)void refreshTeamWorkspace();else saveLocal();},
}));

const queueKey=(w:TeamWorkspace)=>'alu-team-pending-v1:'+w.member.id;
const mutationJobId=(change:TeamMutation)=>change.type==='update'?change.id:change.job.id;
function persistPending(w:TeamWorkspace){
 try{
  if(w.pending.length)sessionStorage.setItem(queueKey(w),JSON.stringify(w.pending));
  else sessionStorage.removeItem(queueKey(w));
  w.draftError='';
 }catch{w.draftError='Nacrt nije sačuvan na uređaju. Ostavite aplikaciju otvorenu dok se izmene ne pošalju.';}
}
function publishWorkspace(w:TeamWorkspace){
 if(workspace!==w)return;
 const jobs=new Map([...w.rows].map(([id,row])=>[id,row.data]));
 for(const change of w.pending){
  if(change.type==='create')jobs.set(change.job.id,change.job);
  else if(change.type==='delete')jobs.delete(change.job.id);
  else {
   const job=jobs.get(change.id);
   if(job)jobs.set(change.id,{...job,...change.patch,updated:change.updated});
  }
 }
 const error=w.mutationError||w.connectionError||w.draftError;
 useStore.setState({
  jobs:[...jobs.values()].sort((a,b)=>Date.parse(b.updated)-Date.parse(a.updated)),
  teamAssignments:Object.fromEntries([...w.rows].map(([id,row])=>[id,row.assigned_to])),
  saveState:error?'error':w.pending.length?'dirty':'saved',storageError:error,teamConflict:w.conflict,
 });
}
function enqueue(change:TeamMutation){
 const w=workspace;
 if(!w)return;
 w.pending.push(change);
 persistPending(w);
 publishWorkspace(w);
 void flushWorkspace(w);
}
function rememberJob(w:TeamWorkspace,row:TeamJob){
 if((w.rows.get(row.id)?.revision??0)<=row.revision)w.rows.set(row.id,row);
 w.epoch++;
}
async function flushWorkspace(w:TeamWorkspace){
 if(workspace!==w||w.running||w.conflict||!w.pending.length)return;
 w.running=true;
 try{
  while(workspace===w&&w.pending.length){
   const change=w.pending[0];
   if(change.type==='delete'){
    await deleteTeamJob(change.job);
    w.rows.delete(change.job.id);
    w.epoch++;
   }else{
    const row=change.type==='create'?await createTeamJob(change.job):await updateTeamJob(change.id,change.patch,change.expected);
    rememberJob(w,row);
   }
   w.pending.shift();
   w.mutationError='';
   persistPending(w);
   publishWorkspace(w);
  }
 }catch(error){
  const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
  w.conflict=['40001','42501','22023','23505'].includes(String(code));
  w.mutationError=w.conflict?'Izmena čeka proveru. '+(error instanceof Error?error.message:''): 'Izmene čekaju slanje. Proverite vezu ili pokušajte ponovo.';
  publishWorkspace(w);
 }finally{w.running=false;}
}

export async function refreshTeamWorkspace(){
 const w=workspace;
 if(!w||w.refreshing)return;
 w.refreshing=true;
 try{
  const epoch=w.epoch;
  const rows=await fetchTeamJobs(new Map(w.rows));
  if(workspace!==w)return;
  if(epoch===w.epoch)w.rows=new Map(rows.map(row=>[row.id,row]));
  w.connectionError='';
 }catch{
  w.connectionError='Zajednički poslovi trenutno nisu dostupni. Proverite vezu i pokušajte ponovo.';
 }finally{
  w.refreshing=false;
  publishWorkspace(w);
 }
 await flushWorkspace(w);
}
export async function beginTeamWorkspace(member:TeamMember){
 if(workspace?.member.id===member.id)return;
 const w:TeamWorkspace={member,rows:new Map(),pending:[],epoch:0,running:false,refreshing:false,conflict:false,mutationError:'',connectionError:'',draftError:''};
 try{
  const pending=JSON.parse(sessionStorage.getItem(queueKey(w))??'[]');
  if(Array.isArray(pending))w.pending=pending;
 }catch{/* Only the authorized user's pending queue is loaded. */}
 workspace=w;
 useStore.setState({teamMember:member});
 publishWorkspace(w);
 await refreshTeamWorkspace();
}
export function endTeamWorkspace(){
 if(!workspace)return;
 workspace=undefined;
 useStore.setState({jobs:localJobs,teamMember:null,teamAssignments:{},teamConflict:false,storageError:'',saveState:'saved'});
}
export function workspaceDraftKey(key:string){return workspace?`alu-team-draft:${workspace.member.id}:${key}`:key;}
export function acceptTeamJob(row:TeamJob,memberId:string){
 if(workspace?.member.id!==memberId)return;
 rememberJob(workspace,row);
 publishWorkspace(workspace);
}
export function discardConflictingTeamChange(){
 const w=workspace;
 if(!w?.conflict||!w.pending.length)return;
 const id=mutationJobId(w.pending[0]);
 w.pending=w.pending.filter(change=>mutationJobId(change)!==id);
 w.conflict=false;
 w.mutationError='';
 persistPending(w);
 publishWorkspace(w);
 void refreshTeamWorkspace();
}

let timer:ReturnType<typeof setTimeout>;
function saveLocal(){const s=useStore.getState();try{localStorage.setItem(KEY,JSON.stringify({jobs:localJobs,settings:s.settings}));if(!workspace)useStore.setState({saveState:'saved',storageError:''});}catch{if(!workspace)useStore.setState({saveState:'error',storageError:'Nema dovoljno lokalnog prostora ili je čuvanje blokirano. Izvezite rezervnu kopiju i uklonite velike fotografije.'});}}
useStore.subscribe((s,prev)=>{
 if(!workspace&&s.jobs!==prev.jobs)localJobs=s.jobs;
 if((!workspace&&s.jobs!==prev.jobs)||s.settings!==prev.settings){clearTimeout(timer);timer=setTimeout(saveLocal,350);}
});
window.addEventListener('pagehide',()=>{if(!workspace&&useStore.getState().saveState==='dirty')saveLocal();});
if(!initialError)saveLocal();
