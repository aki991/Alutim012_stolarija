import { create } from 'zustand';
import type { DeletedJob, Job, Position, Settings } from './models';
import { catalog, makePosition, uid } from './catalog';
import { defaults } from './services/calculation';
import { parseBackup } from './services/storage';
import { createTeamJob, deleteTeamJob, fetchTeamJobs, fetchTeamPreferences, fetchTeamPricing, saveTeamPreferences, saveTeamPricing, updateTeamJob, type PriceSettings, type TeamJob, type TeamMember, type TeamPreferences, type TeamPreferencesRow, type TeamPricingRow } from './services/team-api';
const KEY='alu-tim-teren-v1';
export const todayInBelgrade=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Belgrade'});
export function emptyJob(technician:string): Job {return {id:'AT-'+new Date().getFullYear()+'-'+uid().slice(0,8).toUpperCase(),customer:{name:'',phone:'',email:'',address:'',building:'Porodična kuća'},date:todayInBelgrade(),createdAt:new Date().toISOString(),technician,notes:'',status:'U izradi',positions:[],package:'Standard',discount:0,transport:defaults.prices.transport,extraWork:'',extraCost:0,validity:'15 dana',delivery:'Po dogovoru, nakon tehničke provere',payment:'50% avans, ostatak po montaži',updated:new Date().toISOString()};}
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
 jobs:Job[];trash:DeletedJob[];settings:Settings;saveState:SaveState;storageError:string;
 teamMember:TeamMember|null;teamConflict:boolean;teamAssignments:Record<string,string|null>;
 teamAssigneeOnly:Record<string,boolean>;
 teamPricingRevision:number|null;teamPricingError:string;
 updateJob:(id:string,patch:Partial<Job>,baseline?:Job)=>void;addJob:(job:Job)=>void;deleteJob:(id:string)=>void;restoreLocalJob:(id:string)=>void;duplicateJob:(id:string)=>string;
 purgeLocalJobs:(ids:ReadonlySet<string>)=>void;
 updatePosition:(job:string,id:string,patch:Partial<Position>)=>void;setSettings:(patch:Partial<Settings>)=>void;
 importData:(data:unknown)=>void;retrySave:()=>void;
}
export const assignedMeasurement=(state:Pick<AppState,'teamAssignments'>,job:Job)=>job.status==='Merenje'&&Boolean(state.teamAssignments[job.id]);
type JobAccess=Pick<AppState,'teamAssignments'|'teamMember'>;
export const canEditJob=(state:JobAccess,job:Pick<Job,'id'>)=>state.teamMember?.role!=='worker'
 ||!Object.hasOwn(state.teamAssignments,job.id)||state.teamAssignments[job.id]===state.teamMember.id;
export const awaitingMeasurements=(state:JobAccess,job:Job)=>assignedMeasurement(state,job)
 &&state.teamAssignments[job.id]!==state.teamMember?.id;
export const canEditPrices=(state:Pick<AppState,'teamMember'>)=>state.teamMember?.role!=='worker';
export const hasPositionPriceCorrection=(p:Position)=>p.manualPrice!=null||Boolean(p.extraCost);
export const withPositionPrice=(p:Position,source?:Position)=>({...p,manualPrice:source?.manualPrice??null,extraCost:source?.extraCost??0});
export function workerJobPricing(transport:number):Partial<Job>{
 return {package:'Standard',transport,discount:0,discountMode:undefined,surcharge:undefined,surchargeMode:undefined,
  manualTotal:undefined,extraCost:0,vat:undefined,vatMode:undefined};
}
type TeamMutation=
 | {type:'create';job:Job}
 | {type:'update';id:string;patch:Partial<Job>;expected:Partial<Job>;updated:string}
 | {type:'delete';job:Job;revision?:number}
 | {type:'preferences';patch:TeamPreferences};
interface TeamWorkspace {
 member:TeamMember; rows:Map<string,TeamJob>; pending:TeamMutation[]; epoch:number;
 preferences:TeamPreferencesRow|null; preferencesError:string;
 running:boolean; refreshing:boolean; pricingRefreshing:boolean; conflict:boolean; mutationError:string; connectionError:string; draftError:string;
}
const sampleJobs=demoJobs();
let initial:ReturnType<typeof parseBackup>={jobs:sampleJobs,trash:[],settings:defaults},initialError='';
try {const raw=localStorage.getItem(KEY);if(raw)initial=parseBackup(JSON.parse(raw));}catch {initialError='Lokalni podaci nisu dostupni ili su oštećeni. Prikazani su demonstracioni podaci.';}
let workspace:TeamWorkspace|undefined,localJobs=initial.jobs,localTrash=initial.trash,localSettings=initial.settings;
const preferenceKeys=['showPrices','elementDefaults','documentDefaults'] as const;
function pickPreferences(settings:Partial<Settings>):TeamPreferences{
 return Object.fromEntries(preferenceKeys.filter(key=>settings[key]!==undefined).map(key=>[key,settings[key]]));
}
function currentPreferences(w:TeamWorkspace):TeamPreferences{
 const preferences={...pickPreferences(localSettings),...w.preferences?.data};
 for(const change of w.pending)if(change.type==='preferences')Object.assign(preferences,change.patch);
 return preferences;
}
function pickPricing(settings:Settings):PriceSettings{
 const {prices,portaRoyalPrices,vat,vatMode}=settings;
 return {prices,portaRoyalPrices,vat,vatMode};
}
export function localPricingForImport(){
 const price=pickPricing(localSettings);
 const hasChanges=price.vat!==defaults.vat||price.vatMode!==defaults.vatMode||Object.keys(price.portaRoyalPrices??{}).length>0
  ||Object.entries(price.prices).some(([key,value])=>defaults.prices[key as keyof Settings['prices']]!==value);
 return hasChanges?price:null;
}
export const useStore=create<AppState>((set,get)=>({
 ...initial,saveState:initialError?'error':'saved',storageError:initialError,
 teamMember:null,teamConflict:false,teamAssignments:{},teamAssigneeOnly:{},teamPricingRevision:null,teamPricingError:'',
 updateJob:(id,patch,baseline)=>{
  if(workspace){
   const job=get().jobs.find(j=>j.id===id);
   if(!job||!canEditJob(get(),job))return;
   const previous=baseline??job;
   if(workspace.member.role==='worker'&&patch.positions){
    const positions=new Map(job.positions.map(p=>[p.id,p]));
    patch={...patch,positions:patch.positions.map(p=>withPositionPrice(p,positions.get(p.id)))};
   }
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
  if(workspace){
   const worker=workspace.member.role==='worker';
   enqueue({type:'create',job:{...job,technician:workspace.member.name,status:worker?'Merenje':job.status,
    positions:worker?job.positions.map(p=>withPositionPrice(p)):job.positions}});
   return;
  }
  set(s=>({jobs:[job,...s.jobs],saveState:'dirty'}));
 },
 deleteJob:id=>{
  if(workspace){
   const job=get().jobs.find(j=>j.id===id);
   if(job&&workspace.member.role==='manager')enqueue({type:'delete',job});
   return;
  }
  set(s=>{
   const job=s.jobs.find(item=>item.id===id);
   return job?{jobs:s.jobs.filter(item=>item.id!==id),trash:[{job,deletedAt:new Date().toISOString()},...s.trash],saveState:'dirty'}:s;
  });
 },
 restoreLocalJob:id=>{
  if(workspace)return;
  set(s=>{
   const entry=s.trash.find(item=>item.job.id===id);
   return entry?{jobs:[entry.job,...s.jobs],trash:s.trash.filter(item=>item!==entry),saveState:'dirty'}:s;
  });
 },
 purgeLocalJobs:ids=>{
  if(workspace)return;
  const trash=get().trash.filter(({job})=>!ids.has(job.id));
  if(!saveLocal(trash))throw new Error('Korpa nije sačuvana na uređaju.');
  set({trash});
 },
 duplicateJob:id=>{
  const state=get(),original=state.jobs.find(j=>j.id===id)!;
  const fresh=jobFromSettings(state.settings),job=structuredClone(original);
  const worker=state.teamMember?.role==='worker';
  const pricing=worker?workerJobPricing(fresh.transport):{};
  const copy={...job,...pricing,id:fresh.id,customer:{...job.customer,name:job.customer.name+' (kopija)'},
   status:fresh.status,createdAt:fresh.createdAt,updated:fresh.updated,
   positions:job.positions.map(p=>({...p,id:uid()}))};
  state.addJob(copy);
  return copy.id;
 },
 updatePosition:(job,id,patch)=>{const j=get().jobs.find(j=>j.id===job);if(j)get().updateJob(job,{positions:j.positions.map(p=>p.id===id?{...p,...patch}:p)});},
 setSettings:patch=>{
  if(!workspace){set(s=>({settings:{...s.settings,...patch},saveState:'dirty'}));return;}
  const preferences=pickPreferences(patch);
  if(Object.keys(preferences).length)enqueue({type:'preferences',patch:preferences});
 },
 importData:data=>{
  const d=parseBackup(data);
  if(workspace)return;
  set({jobs:d.jobs,settings:d.settings,saveState:'dirty'});
 },
 retrySave:()=>{if(workspace)void refreshTeamWorkspace();else saveLocal();},
}));

const queueKey=(w:TeamWorkspace)=>'alu-team-pending-v1:'+w.member.id;
const mutationTarget=(change:TeamMutation)=>change.type==='update'?change.id:change.type==='preferences'?null:change.job.id;
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
  else if(change.type==='update'){
   const job=jobs.get(change.id);
   const row=w.rows.get(change.id);
   if(job&&(!row||w.member.role==='manager'||row.assigned_to===w.member.id))jobs.set(change.id,{...job,...change.patch,updated:change.updated});
  }
 }
 const error=w.mutationError||w.connectionError||w.preferencesError||w.draftError;
 const preferences=currentPreferences(w);
 useStore.setState(state=>{
  const {settings}=state;
  const showPrices=state.teamPricingRevision===null?false:preferences.showPrices;
  const {elementDefaults,documentDefaults}=preferences;
  const settingsChanged=showPrices!==settings.showPrices||elementDefaults!==settings.elementDefaults||documentDefaults!==settings.documentDefaults;
  return {
   jobs:[...jobs.values()].sort((a,b)=>Date.parse(b.updated)-Date.parse(a.updated)),
   teamAssignments:Object.fromEntries([...w.rows].map(([id,row])=>[id,row.assigned_to])),
   teamAssigneeOnly:Object.fromEntries([...w.rows].map(([id,row])=>[id,row.assignee_only])),
   settings:settingsChanged?{...settings,showPrices,elementDefaults,documentDefaults}:settings,
   saveState:error?'error':w.pending.length?'dirty':'saved',storageError:error,teamConflict:w.conflict,
  };
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
    if(change.revision===undefined){
     change.revision=w.rows.get(change.job.id)?.revision;
     persistPending(w);
    }
    await deleteTeamJob(change.job,change.revision);
    const current=w.rows.get(change.job.id);
    if(!current||change.revision===undefined||current.revision<=change.revision)w.rows.delete(change.job.id);
    w.epoch++;
   }else if(change.type==='preferences'){
    const row=await saveTeamPreferences(change.patch);
    if(row.revision>=(w.preferences?.revision??0))w.preferences=row;
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
 void refreshTeamPricing();
 w.refreshing=true;
 const epoch=w.epoch;
 const [jobs,preferences]=await Promise.allSettled([fetchTeamJobs(new Map(w.rows)),fetchTeamPreferences()]);
 w.refreshing=false;
 if(workspace!==w)return;
 if(jobs.status==='fulfilled'&&epoch===w.epoch)w.rows=new Map(jobs.value.map(row=>[row.id,row]));
 if(preferences.status==='fulfilled'&&preferences.value&&preferences.value.revision>(w.preferences?.revision??0))w.preferences=preferences.value;
 w.connectionError=jobs.status==='rejected'?'Zajednički poslovi trenutno nisu dostupni. Proverite vezu i pokušajte ponovo.':'';
 w.preferencesError=preferences.status==='rejected'?'Podešavanja naloga trenutno nisu dostupna. Proverite vezu i pokušajte ponovo.':'';
 publishWorkspace(w);
 await flushWorkspace(w);
}

function publishTeamPricing(w:TeamWorkspace,row:TeamPricingRow){
 if(workspace!==w)return;
 useStore.setState(state=>{
  if(state.teamPricingRevision!==null&&row.revision<state.teamPricingRevision)return state;
  const updated=row.revision!==state.teamPricingRevision;
  return {teamPricingRevision:row.revision,teamPricingError:'',settings:updated?{
   ...state.settings,showPrices:currentPreferences(w).showPrices,prices:{...defaults.prices,...row.prices},
   portaRoyalPrices:row.porta_royal_prices,vat:row.vat,vatMode:row.vat_mode,
  }:state.settings};
 });
}

export async function refreshTeamPricing(){
 const w=workspace;
 if(!w||w.pricingRefreshing)return;
 w.pricingRefreshing=true;
 try{publishTeamPricing(w,await fetchTeamPricing());}
 catch{if(workspace===w)useStore.setState({teamPricingError:'Zajednički cenovnik trenutno nije dostupan.'});}
 finally{w.pricingRefreshing=false;}
}

export async function saveWorkspacePricing(value:PriceSettings,revision:number){
 const w=workspace;
 if(w?.member.role!=='manager')throw new Error('Cene može da menja samo administrator.');
 publishTeamPricing(w,await saveTeamPricing(value,revision));
}

export async function beginTeamWorkspace(member:TeamMember){
 if(workspace?.member.id===member.id)return;
 const w:TeamWorkspace={member,rows:new Map(),pending:[],epoch:0,preferences:null,preferencesError:'',running:false,refreshing:false,pricingRefreshing:false,conflict:false,mutationError:'',connectionError:'',draftError:''};
 try{
  const pending=JSON.parse(sessionStorage.getItem(queueKey(w))??'[]');
  if(Array.isArray(pending))w.pending=pending;
 }catch{/* Only the authorized user's pending queue is loaded. */}
 workspace=w;
 useStore.setState({teamMember:member,trash:[],teamPricingRevision:null,teamPricingError:'',settings:{...localSettings,...pickPricing(defaults),showPrices:false}});
 publishWorkspace(w);
 await Promise.all([refreshTeamPricing(),refreshTeamWorkspace()]);
}
export function endTeamWorkspace(){
 if(!workspace)return;
 workspace=undefined;
 useStore.setState({jobs:localJobs,trash:localTrash,settings:localSettings,teamMember:null,teamAssignments:{},teamAssigneeOnly:{},teamConflict:false,teamPricingRevision:null,teamPricingError:'',storageError:'',saveState:'saved'});
}
export function findLocalJob(id:string){
 return localJobs.find(job=>job.id===id);
}
export function listLocalJobs():Job[]{
 return localJobs.filter(job=>!sampleJobs.some(sample=>sample.id===job.id
  &&sample.customer.name===job.customer.name&&sample.customer.email===job.customer.email));
}
export function workspaceDraft(key:string,offline:boolean){
 const memberId=workspace?.member.id;
 const persistent=offline&&!memberId;
 const storageKey=memberId?`alu-team-draft:${memberId}:${key}`:key;
 const storage=()=>persistent?localStorage:sessionStorage;
 return {
  read:()=>storage().getItem(storageKey)??(persistent?sessionStorage.getItem(key):null),
  write:(position:Position)=>storage().setItem(storageKey,JSON.stringify(position)),
  commit:(save:()=>void,keepDraft=false)=>{
   if(!persistent){
    save();
    const saved=Boolean(memberId)||useStore.getState().saveState!=='error';
    if(saved&&!keepDraft)try{sessionStorage.removeItem(storageKey);}catch{/* The update was already saved. */}
    return saved;
   }
   // Free space before saving the same photos as part of the job.
   let previous:string|null=null;
   try{previous=localStorage.getItem(storageKey);localStorage.removeItem(storageKey);}
   catch{/* The job save reports storage failures. */}
   let saved=false;
   try{
    save();
    saved=useStore.getState().saveState!=='error';
   }finally{
    try{
     if(saved)sessionStorage.removeItem(key);
     else if(previous!==null)localStorage.setItem(storageKey,previous);
    }catch{/* Keep the existing job storage error. */}
   }
   return saved;
  },
 };
}
export function acceptTeamJob(row:TeamJob,memberId:string){
 if(workspace?.member.id!==memberId)return;
 rememberJob(workspace,row);
 publishWorkspace(workspace);
}
export function discardConflictingTeamChange(){
 const w=workspace;
 if(!w?.conflict||!w.pending.length)return;
 const id=mutationTarget(w.pending[0]);
 w.pending=w.pending.filter(change=>mutationTarget(change)!==id);
 w.conflict=false;
 w.mutationError='';
 persistPending(w);
 publishWorkspace(w);
 void refreshTeamWorkspace();
}

let timer:ReturnType<typeof setTimeout>;
function saveLocal(trash=localTrash){try{localStorage.setItem(KEY,JSON.stringify({jobs:localJobs,trash,settings:localSettings}));if(!workspace)useStore.setState({saveState:'saved',storageError:''});return true;}catch{if(!workspace)useStore.setState({saveState:'error',storageError:'Nema dovoljno lokalnog prostora ili je čuvanje blokirano. Izvezite rezervnu kopiju i uklonite velike fotografije.'});return false;}}
useStore.subscribe((s,prev)=>{
 if(workspace)return;
 if(s.jobs!==prev.jobs)localJobs=s.jobs;
 if(s.trash!==prev.trash)localTrash=s.trash;
 if(s.settings!==prev.settings)localSettings=s.settings;
 if(s.jobs!==prev.jobs||s.trash!==prev.trash){clearTimeout(timer);saveLocal();}
 else if(s.settings!==prev.settings){clearTimeout(timer);timer=setTimeout(saveLocal,350);}
});
window.addEventListener('pagehide',()=>{if(!workspace&&useStore.getState().saveState==='dirty')saveLocal();});
if(!initialError)saveLocal();
