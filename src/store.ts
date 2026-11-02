import { create } from 'zustand';
import type { Job, Position, Settings } from './models';
import { catalog, makePosition, uid } from './catalog';
import { defaults } from './services/calculation';
import { parseBackup } from './services/storage';
const KEY='alu-tim-teren-v1';
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Belgrade'});
export function emptyJob(technician:string): Job {return {id:'AT-'+new Date().getFullYear()+'-'+uid().slice(0,8).toUpperCase(),customer:{name:'',phone:'',email:'',address:'',building:'Porodična kuća'},date:today(),createdAt:new Date().toISOString(),technician,notes:'',status:'U izradi',positions:[],package:'Standard',discount:0,transport:defaults.prices.transport,extraWork:'',extraCost:0,validity:'15 dana',delivery:'Po dogovoru, nakon tehničke provere',payment:'50% avans, ostatak po montaži',updated:new Date().toISOString()};}
function demoJobs():Job[] {
 const p={...makePosition(),name:'Dnevna soba · dvokrilni prozor',quantity:2,shutter:true,mosquito:true,removal:true,notes:'Proveriti završnu meru nakon skidanja stare obloge.',photos:['/assets/house.jpg'],access:'Prizemlje, pristup iz dvorišta.'};
 const single={...makePosition(catalog[0]),name:'Kuhinja · jednokrilni prozor',width:800,height:1000,removal:true};
 const balcony={...makePosition(catalog[5]),name:'Terasa · balkonska vrata',removal:true,color:'Antracit'};
 return [
 {...emptyJob(defaults.technician),id:'AT-2026-012',customer:{name:'Porodica Petrović',phone:'064 123 4567',email:'petrovic@example.com',address:'Vojvođanska 24, Pančevo',building:'Porodična kuća'},positions:[p,single,balcony],notes:'Zamena stare stolarije u prizemlju. Zaštititi podove pre demontaže.',status:'U izradi'},
 {...emptyJob(defaults.technician),id:'AT-2026-011',customer:{name:'Jovanović d.o.o.',phone:'063 456 7890',email:'office@example.com',address:'Cara Dušana 17, Pančevo',building:'Poslovni prostor'},positions:[{...makePosition(catalog[7]),material:'ALU',color:'Antracit'}],status:'Ponuda',discount:5},
 {...emptyJob(defaults.technician),id:'AT-2026-010',customer:{name:'Milan Zorić',phone:'065 222 3344',email:'',address:'Industrijska zona bb, Pančevo',building:'Poslovni prostor'},positions:[{...makePosition(catalog[3]),material:'ALU'}],status:'Čeka proveru'},
 {...emptyJob(defaults.technician),id:'AT-2026-009',customer:{name:'Ana Nikolić',phone:'064 333 5566',email:'',address:'Svetog Save 8, Starčevo',building:'Stan'},positions:[makePosition(catalog[0])],status:'Završeno'},
 ];
}
type SaveState='saved'|'dirty'|'error';
interface AppState {jobs:Job[];settings:Settings;saveState:SaveState;storageError:string;updateJob:(id:string,patch:Partial<Job>)=>void;addJob:(job:Job)=>void;deleteJob:(id:string)=>void;duplicateJob:(id:string)=>string;updatePosition:(job:string,id:string,patch:Partial<Position>)=>void;setSettings:(patch:Partial<Settings>)=>void;importData:(data:unknown)=>void;retrySave:()=>void}
let initial:{jobs:Job[];settings:Settings}={jobs:demoJobs(),settings:defaults},initialError='';
try {const raw=localStorage.getItem(KEY);if(raw)initial=parseBackup(JSON.parse(raw));}catch {initialError='Lokalni podaci nisu dostupni ili su oštećeni. Prikazani su demonstracioni podaci.';}
export const useStore=create<AppState>((set,get)=>({
 ...initial,saveState:initialError?'error':'saved',storageError:initialError,
 updateJob:(id,patch)=>set(s=>({jobs:s.jobs.map(j=>j.id===id?{...j,...patch,updated:new Date().toISOString()}:j),saveState:'dirty'})),
 addJob:job=>set(s=>({jobs:[job,...s.jobs],saveState:'dirty'})),
 deleteJob:id=>set(s=>({jobs:s.jobs.filter(j=>j.id!==id),saveState:'dirty'})),
 duplicateJob:id=>{const j=get().jobs.find(j=>j.id===id)!;const copy={...structuredClone(j),id:emptyJob(get().settings.technician).id,customer:{...j.customer,name:j.customer.name+' (kopija)'},status:'U izradi' as const,createdAt:new Date().toISOString(),updated:new Date().toISOString(),positions:j.positions.map(p=>({...structuredClone(p),id:uid()}))};get().addJob(copy);return copy.id;},
 updatePosition:(job,id,patch)=>{const j=get().jobs.find(j=>j.id===job)!;get().updateJob(job,{positions:j.positions.map(p=>p.id===id?{...p,...patch}:p)});},
 setSettings:patch=>set(s=>({settings:{...s.settings,...patch},saveState:'dirty'})),
 importData:data=>{const d=parseBackup(data);set({jobs:d.jobs,settings:d.settings,saveState:'dirty'});},
 retrySave:()=>save(),
}));
let timer:ReturnType<typeof setTimeout>;
function save(){const s=useStore.getState();try{localStorage.setItem(KEY,JSON.stringify({jobs:s.jobs,settings:s.settings}));useStore.setState({saveState:'saved',storageError:''});}catch{useStore.setState({saveState:'error',storageError:'Nema dovoljno lokalnog prostora ili je čuvanje blokirano. Izvezite rezervnu kopiju i uklonite velike fotografije.'});}}
useStore.subscribe((s,prev)=>{if(s.jobs!==prev.jobs||s.settings!==prev.settings){clearTimeout(timer);timer=setTimeout(save,350);}});
window.addEventListener('pagehide',()=>{if(useStore.getState().saveState==='dirty')save();});
if(!initialError)save();
