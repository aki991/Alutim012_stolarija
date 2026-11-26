import { canChangeAssignment, type JobOrigin } from './services/job-assignment';
import { create } from 'zustand';
import type { DeletedJob, Job, Position, Settings } from './models';
import { catalog, makePosition, uid } from './catalog';
import { defaults } from './services/calculation';
import { parseBackup, type LocalSnapshot } from './services/storage';
import { LocalConflict, localSaveError, localWorkspaceKey, LocalWorkspaceStorage } from './services/local-workspace';
import { positionDraft } from './services/position-draft';
import { canChangeJobStatus, jobProgressPatch } from './services/job-progress';
import { teamPriceVisibility } from './services/price-visibility';
import { todayInBelgrade } from './services/measurement-schedule';
import { jobsWithPendingChanges, mutationTarget, readTeamMutations, writeTeamMutations, type TeamMutation } from './services/team-mutations';
import { createTeamJob, deleteTeamJob, fetchTeamJobs, fetchTeamPreferences, fetchTeamPricing, saveTeamPreferences, saveTeamPricing, setWorkerPriceVisibility, updateTeamJob, type PriceSettings, type TeamJob, type TeamMember, type TeamPreferences, type TeamPreferencesRow, type TeamPricingRow } from './services/team-api';
export function emptyJob(technician:string): Job {return {id:'AT-'+new Date().getFullYear()+'-'+uid().slice(0,8).toUpperCase(),customer:{name:'',phone:'',email:'',address:'',building:'Porodična kuća'},date:todayInBelgrade(),createdAt:new Date().toISOString(),technician,notes:'',status:'Merenje',positions:[],package:'Standard',discount:0,transport:defaults.prices.transport,extraWork:'',extraCost:0,validity:'15 dana',delivery:'Po dogovoru, nakon tehničke provere',payment:'50% avans, ostatak po montaži',updated:new Date().toISOString()};}
export function jobFromSettings(settings:Settings):Job {
 return {...emptyJob(settings.technician),siteCosts:{installation:0,travel:0},transport:settings.prices.transport,...settings.documentDefaults};
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
 teamAssigneeOnly:Record<string,boolean>;teamJobOrigins:Record<string,JobOrigin>;
 teamWorkerPricesVisible:boolean|null;teamPricingRevision:number|null;teamPricingError:string;
 updateJob:(id:string,patch:Partial<Job>,baseline?:Job)=>void;addJob:(job:Job)=>void;deleteJob:(id:string)=>void;restoreLocalJob:(id:string)=>void;duplicateJob:(id:string)=>string;
 purgeLocalJobs:(ids:ReadonlySet<string>)=>void;
 updatePosition:(job:string,id:string,patch:Partial<Position>)=>void;setSettings:(patch:Partial<Settings>)=>void;
 importData:(data:unknown)=>void;retrySave:()=>void;
}
export const assignedMeasurement=(state:Pick<AppState,'teamAssignments'>,job:Job)=>job.status==='Merenje'&&Boolean(state.teamAssignments[job.id]);
type JobAccess=Pick<AppState,'teamAssignments'|'teamMember'>;
export const canEditJob=(state:JobAccess,job:Pick<Job,'id'>&Partial<Pick<Job,'status'|'salonRequest'>>)=>state.teamMember?.role!=='salon'&&(!(job.salonRequest&&job.status==='Merenje')||state.teamAssignments[job.id]===state.teamMember?.id)&&(state.teamMember?.role!=='worker'
 ||!Object.hasOwn(state.teamAssignments,job.id)||state.teamAssignments[job.id]===state.teamMember.id);
export const awaitingMeasurements=(state:JobAccess,job:Job)=>assignedMeasurement(state,job)
 &&state.teamAssignments[job.id]!==state.teamMember?.id&&!(job.salonRequest&&state.teamMember?.role==='manager'&&job.positions.length>0);
export const canReassignJob=(state:Pick<AppState,'teamMember'|'teamJobOrigins'>,id:string)=>canChangeAssignment(state.teamMember,state.teamJobOrigins[id]);
export const canEditPrices=(state:Pick<AppState,'teamMember'>)=>!state.teamMember||state.teamMember.role==='manager';
export const hasPositionPriceCorrection=(p:Position)=>p.manualPrice!=null||Boolean(p.extraCost);
export const withPositionPrice=(p:Position,source?:Position)=>({...p,manualPrice:source?.manualPrice??null,extraCost:source?.extraCost??0});
export function workerJobPricing(transport:number):Partial<Job>{
 return {package:'Standard',transport,discount:0,discountMode:undefined,surcharge:undefined,surchargeMode:undefined,
  manualTotal:undefined,extraCost:0,vat:undefined,vatMode:undefined};
}
interface TeamWorkspace {
 member:TeamMember; rows:Map<string,TeamJob>; pending:TeamMutation[]; epoch:number;
 preferences:TeamPreferencesRow|null; preferencesError:string;
 running:boolean; refreshing:boolean; pricingRefreshing:boolean; conflict:boolean; mutationError:string; connectionError:string; draftError:string;
}
const sampleJobs=demoJobs();
const localStorageRepository=new LocalWorkspaceStorage(()=>localStorage,{jobs:sampleJobs,trash:[],settings:defaults});
const initial=localStorageRepository.load();
let workspace:TeamWorkspace|undefined,local=initial.data,localError=initial.error;
const preferenceKeys=['showPrices','elementDefaults','documentDefaults'] as const;
function pickPreferences(settings:Partial<Settings>):TeamPreferences{
 return Object.fromEntries(preferenceKeys.filter(key=>settings[key]!==undefined).map(key=>[key,settings[key]]));
}
function currentPreferences(w:TeamWorkspace):TeamPreferences{
 const preferences={...pickPreferences(local.settings),...w.preferences?.data};
 for(const change of w.pending)if(change.type==='preferences')Object.assign(preferences,change.patch);
 return preferences;
}
function pickPricing(settings:Settings):PriceSettings{
 const {prices,portaRoyalPrices,vat,vatMode}=settings;
 return {prices,portaRoyalPrices,vat,vatMode};
}
export function localPricingForImport(){
 const price=pickPricing(local.settings);
 const hasChanges=price.vat!==defaults.vat||price.vatMode!==defaults.vatMode||Object.keys(price.portaRoyalPrices??{}).length>0
  ||Object.entries(price.prices).some(([key,value])=>defaults.prices[key as keyof Settings['prices']]!==value);
 return hasChanges?price:null;
}
export const useStore=create<AppState>((set,get)=>({
 ...initial.data,saveState:initial.error?'error':'saved',storageError:initial.error,
 teamMember:null,teamConflict:false,teamAssignments:{},teamAssigneeOnly:{},teamJobOrigins:{},teamWorkerPricesVisible:null,teamPricingRevision:null,teamPricingError:'',
 updateJob:(id,patch,baseline)=>{
  const current=get().jobs.find(j=>j.id===id);
  if(!current)return;
  if(baseline)patch=Object.fromEntries((Object.keys(patch) as (keyof Job)[]).filter(key=>JSON.stringify(patch[key])!==JSON.stringify(baseline[key])).map(key=>[key,patch[key]]));
  if(patch.status&&!canChangeJobStatus(current,patch.status,patch.completionDeadline??current.completionDeadline))return;
  patch=jobProgressPatch(current,patch);
  if(workspace){
   const job=current;
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
  set(s=>({jobs:s.jobs.map(j=>j.id===id?{...j,...patch,updated:new Date().toISOString()}:j),saveState:'dirty'}));
 },
 addJob:job=>{
  if(workspace){
   if(workspace.member.role==='salon')return;
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
  const trash=local.trash.filter(({job})=>!ids.has(job.id));
  if(!saveLocal({...local,trash}))throw new Error('Korpa nije sačuvana na uređaju.');
 },
 duplicateJob:id=>{
  const state=get(),original=state.jobs.find(j=>j.id===id)!;
  const fresh=jobFromSettings(state.settings),job=structuredClone(original);
  const worker=state.teamMember?.role==='worker';
  const pricing=worker?workerJobPricing(fresh.transport):{};
  const copy={...job,...pricing,salonRequest:undefined,id:fresh.id,customer:{...job.customer,name:job.customer.name+' (kopija)'},
   status:'U izradi' as const,completionDeadline:'',measuredOn:'',completedOn:'',installedOn:'',createdAt:fresh.createdAt,updated:fresh.updated,
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
  if(!saveLocal(d,true))throw new Error('Rezervna kopija nije sačuvana na uređaju.');
 },
 retrySave:()=>{if(workspace)void refreshTeamWorkspace();else saveLocal();},
}));

function persistPending(w:TeamWorkspace){
 try{
  writeTeamMutations(w.member.id,w.pending);
  w.draftError='';
 }catch{w.draftError='Nacrt nije sačuvan na uređaju. Ostavite aplikaciju otvorenu dok se izmene ne pošalju.';}
}
function publishWorkspace(w:TeamWorkspace){
 if(workspace!==w)return;
 const jobs=jobsWithPendingChanges(w.rows,w.pending,w.member);
 const error=w.mutationError||w.connectionError||w.preferencesError||w.draftError;
 const preferences=currentPreferences(w);
 useStore.setState(state=>{
  const {settings}=state;
  const showPrices=teamPriceVisibility(w.member.role,preferences.showPrices,state.teamPricingRevision!==null,state.teamWorkerPricesVisible);
  const {elementDefaults,documentDefaults}=preferences;
  const settingsChanged=showPrices!==settings.showPrices||elementDefaults!==settings.elementDefaults||documentDefaults!==settings.documentDefaults;
  return {
   jobs,
   teamAssignments:Object.fromEntries([...w.rows].map(([id,row])=>[id,row.assigned_to])),
   teamAssigneeOnly:Object.fromEntries([...w.rows].map(([id,row])=>[id,row.assignee_only])),
   teamJobOrigins:Object.fromEntries([...w.rows].map(([id,row])=>[id,{created_by:row.created_by,assigned_by:row.assigned_by,created_by_name:row.created_by_name,assigned_by_name:row.assigned_by_name,assigned_to_name:row.assigned_to_name,can_reassign:row.can_reassign}])),
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
 const previous=w.rows.get(row.id);
 if((previous?.revision??0)<=row.revision)w.rows.set(row.id,{...row,
  created_by_name:row.created_by_name??previous?.created_by_name,
  assigned_by_name:row.assigned_by_name??previous?.assigned_by_name,
  assigned_to_name:row.assigned_to_name??(previous?.assigned_to===row.assigned_to?previous?.assigned_to_name:undefined),
 });
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
  const workerPricesVisible=typeof row.worker_prices_visible==='boolean'?row.worker_prices_visible:null;
  const updated=row.revision!==state.teamPricingRevision||workerPricesVisible!==state.teamWorkerPricesVisible;
  return {teamWorkerPricesVisible:workerPricesVisible,teamPricingRevision:row.revision,teamPricingError:'',settings:updated?{
   ...state.settings,showPrices:teamPriceVisibility(w.member.role,currentPreferences(w).showPrices,true,workerPricesVisible),prices:{...defaults.prices,...row.prices},
   portaRoyalPrices:row.porta_royal_prices,vat:row.vat,vatMode:row.vat_mode,
  }:state.settings};
 });
}

export async function refreshTeamPricing(){
 const w=workspace;
 if(!w||w.pricingRefreshing||w.member.role==='salon')return;
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

export async function saveWorkerPriceVisibility(visible:boolean,revision:number){
 const w=workspace;
 if(w?.member.role!=='manager')throw new Error('Prikaz cena majstorima podešava samo šef.');
 publishTeamPricing(w,await setWorkerPriceVisibility(visible,revision));
}

export async function beginTeamWorkspace(member:TeamMember){
 if(workspace?.member.id===member.id)return;
 const w:TeamWorkspace={member,rows:new Map(),pending:readTeamMutations(member.id),epoch:0,preferences:null,preferencesError:'',running:false,refreshing:false,pricingRefreshing:false,conflict:false,mutationError:'',connectionError:'',draftError:''};
 workspace=w;
 useStore.setState({teamMember:member,trash:[],teamWorkerPricesVisible:null,teamPricingRevision:null,teamPricingError:'',settings:{...local.settings,...pickPricing(defaults),showPrices:false}});
 publishWorkspace(w);
 await Promise.all([refreshTeamPricing(),refreshTeamWorkspace()]);
}
export function endTeamWorkspace(){
 if(!workspace)return;
 workspace=undefined;
 useStore.setState({...local,teamMember:null,teamAssignments:{},teamAssigneeOnly:{},teamJobOrigins:{},teamConflict:false,teamWorkerPricesVisible:null,teamPricingRevision:null,teamPricingError:'',storageError:localError,saveState:localError?'error':'saved'});
}
export function findLocalJob(id:string){
 return local.jobs.find(job=>job.id===id);
}
export function listLocalJobs():Job[]{
 return local.jobs.filter(job=>!sampleJobs.some(sample=>sample.id===job.id
  &&sample.customer.name===job.customer.name&&sample.customer.email===job.customer.email));
}
export function workspaceDraft(key:string,offline:boolean){
 const memberId=workspace?.member.id;
 return positionDraft(key,memberId,offline,()=>{
  if(!memberId)return useStore.getState().saveState!=='error';
  const w=workspace;
  if(w?.member.id!==memberId)return false;
  if(w.draftError){
   persistPending(w);
   publishWorkspace(w);
  }
  return !w.draftError;
 });
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
export function renameWorkspaceMember(id:string,name:string){
 if(!workspace||workspace.member.id!==id||workspace.member.name===name)return;
 workspace.member={...workspace.member,name};
 useStore.setState({teamMember:workspace.member});
}

let timer:ReturnType<typeof setTimeout>;
function publishLocal(){
 if(!workspace)useStore.setState({...local,saveState:localError?'error':'saved',storageError:localError});
}
function saveLocal(next=local,replace=false){
 try{
  local=localStorageRepository.save(next,replace);
  localError='';
  clearTimeout(timer);
  publishLocal();
  return true;
 }catch(error){
  localError=error instanceof LocalConflict?error.message:localSaveError;
  if(!workspace)useStore.setState({saveState:'error',storageError:localError});
  return false;
 }
}
useStore.subscribe(({jobs,trash,settings})=>{
 if(workspace||(jobs===local.jobs&&trash===local.trash&&settings===local.settings))return;
 const jobsChanged=jobs!==local.jobs||trash!==local.trash;
 local={jobs,trash,settings};
 clearTimeout(timer);
 if(jobsChanged)saveLocal();
 else timer=setTimeout(()=>saveLocal(),350);
});
window.addEventListener('storage',event=>{
 if(event.key!==localWorkspaceKey||local!==localStorageRepository.snapshot)return;
 const latest=localStorageRepository.load();
 local=latest.data;
 localError=latest.error;
 publishLocal();
});
window.addEventListener('pagehide',()=>{if(!workspace&&useStore.getState().saveState==='dirty')saveLocal();});
if(!initial.error)saveLocal();
