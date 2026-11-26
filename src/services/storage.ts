import { isSiteCosts } from './site-costs';
import { isAccessoryDimensions } from '../accessories';
import { isGeometry } from '../custom/geometry';
import { isModelLayout } from '../model-layout';
import { supplementRates } from './pricing-rates';
import { isJobDate, progressDateFields } from './job-progress';
import { jobStatuses, type DeletedJob, type Job, type Position, type Settings } from '../models';
import { isShutterConfig, shutterTypes } from '../shutters';
import { isPortaRoyalConfig, portaSeriesById } from '../porta-royal';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e8;
const draftNumber=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e8;
const strings=(v:Record<string,unknown>,keys:string[])=>keys.every(k=>typeof v[k]==='string'&&(v[k] as string).length<=10000);
export type LocalSnapshot = { jobs:Job[]; settings:Settings; trash:DeletedJob[] };
const fail = ():never => { throw new Error('Datoteka nije podržana ili je rezervna kopija oštećena.'); };

function parseSettings(settings:unknown):Settings{
 if(!record(settings))return fail();
 if(settings.showPrices!==undefined&&typeof settings.showPrices!=='boolean')return fail();
 if(settings.portaRoyalPrices!==undefined&&(!record(settings.portaRoyalPrices)||Object.entries(settings.portaRoyalPrices).some(([key,rate])=>!portaSeriesById(key)||!number(rate))))return fail();
 if(!record(settings.prices)||!strings(settings,['technician'])||!number(settings.vat)||Number(settings.vat)>100||!['exclusive','inclusive','none'].includes(String(settings.vatMode)))return fail();
 const priceKeys=['PVC','ALU','Dvoslojno','Troslojno','Sigurnosno','hardware','secureHardware','shutter','mosquito','sill','installation','removal','transport'];
 if(!priceKeys.every(k=>number((settings.prices as Record<string,unknown>)[k])))return fail();
 if(settings.prices.marginPercent!==undefined&&!number(settings.prices.marginPercent))return fail();
 const optionalRates=['drip','mosquitoMotor',...Object.keys(supplementRates),...Object.values(shutterTypes).map(type=>type.rate)];
 if(optionalRates.some(key=>Object.hasOwn(settings.prices as object,key)&&!number((settings.prices as Record<string,unknown>)[key])))return fail();
 if(settings.elementDefaults!==undefined){const d=settings.elementDefaults;if(!record(d)||!strings(d,['profile','color'])||!['PVC','ALU'].includes(String(d.material))||!['Dvoslojno','Troslojno','Sigurnosno'].includes(String(d.glass))||!['Standardni','Sigurnosni'].includes(String(d.hardware)))return fail();}
 if(settings.documentDefaults!==undefined&&(!record(settings.documentDefaults)||!strings(settings.documentDefaults,['validity','delivery','payment'])))return fail();
 return settings as unknown as Settings;
}

export function parseStoredPosition(p:unknown):Position{
   if(!record(p)||!strings(p,['id','name','color','notes','access','extraWork'])||![p.width,p.height,p.quantity].every(draftNumber)||!number(p.extraCost)||!(p.manualPrice===null||number(p.manualPrice))||!['PVC','ALU'].includes(String(p.material))||!['Dvoslojno','Troslojno','Sigurnosno'].includes(String(p.glass))||!['Standardni','Sigurnosni'].includes(String(p.hardware))||!['Prozori','Vrata','Sobna vrata','Klizni sistemi','Ulazna vrata','Roletne','Komarnici','Klupice','Usluge'].includes(String(p.category))||!['shutter','mosquito','sill','installation','removal'].every(k=>typeof p[k]==='boolean')||!Array.isArray(p.segments)||p.segments.length<1||p.segments.length>4)return fail();
   if(p.doorBottom!==undefined&&p.doorBottom!=='alu24'&&p.doorBottom!=='frame'&&p.doorBottom!=='none')return fail();
   if(p.mosquitoMotor!==undefined&&typeof p.mosquitoMotor!=='boolean')return fail();
   if(p.drip!==undefined&&typeof p.drip!=='boolean')return fail();
   if(p.accessoryDimensions!==undefined&&!isAccessoryDimensions(p.accessoryDimensions))return fail();
   if(p.portaRoyal!==undefined||p.category==='Sobna vrata'||p.elementType==='sobna-vrata'){
    if(!isPortaRoyalConfig(p.portaRoyal)||p.category!=='Sobna vrata'||p.elementType!=='sobna-vrata'||p.modelLayout||p.customGeometry||p.combination||p.fixedPanels||p.shutter||p.shutterConfig||p.mosquito||p.sill||p.drip||p.mosquitoMotor||p.segments.length!==1)return fail();
   }
   if(p.shutterConfig!==undefined&&(!isShutterConfig(p.shutterConfig)||!p.shutter&&p.category!=='Roletne'))return fail();
   if(p.modelLayout!==undefined||p.elementType==='model'){
    if(p.elementType!=='model'||!isModelLayout(p.modelLayout)||p.customGeometry||p.combination||p.fixedPanels||p.segments.length!==1||!record(p.segments[0])||p.segments[0].opening!=='Fiksno'||p.segments[0].width!==p.width)return fail();
   }
   if(p.elementType==='kombinacija'||p.combination!==undefined){
    const c=p.combination;
    if(p.elementType!=='kombinacija'||!record(c)||!draftNumber(c.windowHeight)||!['left','right'].includes(String(c.windowSide))||!['top','bottom'].includes(String(c.alignment))||p.segments.length!==2||p.customGeometry||p.fixedPanels)return fail();
   }
   if(p.fixedPanels!==undefined&&(!record(p.fixedPanels)||p.customGeometry||!["top","bottom","left","right"].every(side=>number((p.fixedPanels as Record<string,unknown>)[side]))))return fail();
   if(p.customInfill!==undefined&&(!p.customGeometry||!['glass','panel'].includes(String(p.customInfill))))return fail();
   if(p.customKind!==undefined&&(!p.customGeometry||!['window','door','other'].includes(String(p.customKind))))return fail();
   if(p.customFrameMm!==undefined&&(!p.customGeometry||!number(p.customFrameMm)||Number(p.customFrameMm)<20||Number(p.customFrameMm)>150))return fail();
   if(p.customGeometry!==undefined&&!isGeometry(p.customGeometry))return fail();
   if(p.elementType==='nacrtaj'&&!isGeometry(p.customGeometry))return fail();
   if(p.customGeometry&&(p.segments.some(s=>!record(s)||s.opening!=='Fiksno')||p.elementType!=='nacrtaj'))return fail();
   if(p.profile!==undefined&&(typeof p.profile!=='string'||p.profile.length>200))return fail();
   if(p.elementType!==undefined&&!['prozor','vrata','sobna-vrata','balkonska','klizni','fiksni','roletna','komarnik','ostalo','nacrtaj','kombinacija','model'].includes(String(p.elementType)))return fail();
   if(p.segments.some(s=>!record(s)||!draftNumber(s.width)||!['Fiksno','Levo','Desno','Kip','Levo + kip','Desno + kip','Klizno'].includes(String(s.opening))))return fail();
   if(!Array.isArray(p.photos)||p.photos.length>4||p.photos.some(src=>typeof src!=='string'||!(src==='/assets/house.jpg'||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src))||src.length>650000))return fail();
 return {...p,profile:p.profile||(p.material==='ALU'?'ALU termo profil':'PVC 70 mm')} as unknown as Position;
}

function parseJob(j:unknown):Job{
 if(!record(j)||!strings(j,['id','date','technician','notes','extraWork','validity','delivery','payment','updated'])||!record(j.customer)||!strings(j.customer,['name','phone','email','address','building'])||!Array.isArray(j.positions)||!(j.status==='Čeka proveru'||jobStatuses.some(status=>status===j.status))||!['Standard','Optimal','Premium'].includes(String(j.package))||![j.discount,j.transport,j.extraCost].every(number)||(j.discountMode!=='amount'&&Number(j.discount)>100)||(j.date!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(String(j.date))))return fail();
 if(j.siteCosts!==undefined&&!isSiteCosts(j.siteCosts))return fail();
 if(progressDateFields.some(key=>j[key]!==undefined&&j[key]!==''&&!isJobDate(j[key])))return fail();
 if(j.discountMode!==undefined&&!['percent','amount'].includes(String(j.discountMode)))return fail();
 if(j.surchargeMode!==undefined&&!['percent','amount'].includes(String(j.surchargeMode)))return fail();
 if(j.surcharge!==undefined&&!number(j.surcharge))return fail();
 if(j.manualTotal!==undefined&&j.manualTotal!==null&&!number(j.manualTotal))return fail();
 if(j.vat!==undefined&&(!number(j.vat)||Number(j.vat)>100))return fail();
 if(j.vatMode!==undefined&&!['exclusive','inclusive','none'].includes(String(j.vatMode)))return fail();
 const positions=j.positions.map(parseStoredPosition);
 if(new Set(positions.map(p=>p.id)).size!==positions.length)return fail();
 return {...j,status:j.status==='Čeka proveru'?'Ponuda':j.status,createdAt:j.createdAt||j.updated||`${j.date}T12:00:00`,positions} as unknown as Job;
}

function parseDeletedJob(entry:unknown):DeletedJob{
 if(!record(entry)||typeof entry.deletedAt!=='string'||!Number.isFinite(Date.parse(entry.deletedAt)))return fail();
 return {job:parseJob(entry.job),deletedAt:entry.deletedAt};
}

export function parseBackup(data:unknown):LocalSnapshot{
 if(!record(data)||!Array.isArray(data.jobs))return fail();
 const rawTrash=data.trash===undefined?[]:data.trash;
 if(!Array.isArray(rawTrash))return fail();
 const settings=parseSettings(data.settings);
 const jobs=data.jobs.map(parseJob),trash=rawTrash.map(parseDeletedJob);
 const ids=[...jobs.map(job=>job.id),...trash.map(({job})=>job.id)];
 if(new Set(ids).size!==ids.length)return fail();
 return {settings,jobs,trash};
}

export function recoverLocalSnapshot(data:unknown,defaults:Settings):LocalSnapshot{
 const snapshot:LocalSnapshot={jobs:[],settings:defaults,trash:[]};
 if(!record(data))return snapshot;
 const ids=new Set<string>();
 try{snapshot.settings=parseSettings(data.settings);}catch{/* Recover jobs even if settings are damaged. */}
 if(Array.isArray(data.jobs))for(const value of data.jobs){
  try{
   const job=parseJob(value);
   if(!ids.has(job.id)){snapshot.jobs.push(job);ids.add(job.id);}
  }catch{/* The original snapshot is retained for recovery. */}
 }
 if(Array.isArray(data.trash))for(const value of data.trash){
  try{
   const entry=parseDeletedJob(value);
   if(!ids.has(entry.job.id)){snapshot.trash.push(entry);ids.add(entry.job.id);}
  }catch{/* The original snapshot is retained for recovery. */}
 }
 return snapshot;
}
