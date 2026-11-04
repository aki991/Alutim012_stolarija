import { isGeometry } from '../custom/geometry';
import { jobStatuses, type Job, type Settings } from '../models';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e8;
const draftNumber=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e8;
const strings=(v:Record<string,unknown>,keys:string[])=>keys.every(k=>typeof v[k]==='string'&&(v[k] as string).length<=10000);
export function parseBackup(data:unknown):{jobs:Job[];settings:Settings}{
 const fail=()=>{throw Error('Datoteka nije podržana ili je rezervna kopija oštećena.');};
 if(!record(data)||!Array.isArray(data.jobs)||!record(data.settings))return fail();
 const {settings}=data;
 if(settings.showPrices!==undefined&&typeof settings.showPrices!=='boolean')return fail();
 if(!record(settings.prices)||!strings(settings,['technician'])||!number(settings.vat)||Number(settings.vat)>100||!['exclusive','inclusive','none'].includes(String(settings.vatMode)))return fail();
 const priceKeys=['PVC','ALU','Dvoslojno','Troslojno','Sigurnosno','hardware','secureHardware','shutter','mosquito','sill','installation','removal','transport'];
 if(!priceKeys.every(k=>number((settings.prices as Record<string,unknown>)[k])))return fail();
 if(settings.elementDefaults!==undefined){const d=settings.elementDefaults;if(!record(d)||!strings(d,['profile','color'])||!['PVC','ALU'].includes(String(d.material))||!['Dvoslojno','Troslojno','Sigurnosno'].includes(String(d.glass))||!['Standardni','Sigurnosni'].includes(String(d.hardware)))return fail();}
 if(settings.documentDefaults!==undefined&&(!record(settings.documentDefaults)||!strings(settings.documentDefaults,['validity','delivery','payment'])))return fail();
 const ids=new Set();
 for(const j of data.jobs){
  if(!record(j)||!strings(j,['id','date','technician','notes','extraWork','validity','delivery','payment','updated'])||!record(j.customer)||!strings(j.customer,['name','phone','email','address','building'])||!Array.isArray(j.positions)||!(j.status==='Čeka proveru'||jobStatuses.some(status=>status===j.status))||!['Standard','Optimal','Premium'].includes(String(j.package))||![j.discount,j.transport,j.extraCost].every(number)||(j.discountMode!=='amount'&&Number(j.discount)>100)||ids.has(j.id)||(j.date!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(String(j.date))))return fail();
  if(j.discountMode!==undefined&&!['percent','amount'].includes(String(j.discountMode)))return fail();
  if(j.surchargeMode!==undefined&&!['percent','amount'].includes(String(j.surchargeMode)))return fail();
  if(j.surcharge!==undefined&&!number(j.surcharge))return fail();
  if(j.manualTotal!==undefined&&j.manualTotal!==null&&!number(j.manualTotal))return fail();
  if(j.vat!==undefined&&(!number(j.vat)||Number(j.vat)>100))return fail();
  if(j.vatMode!==undefined&&!['exclusive','inclusive','none'].includes(String(j.vatMode)))return fail();
  ids.add(j.id);const positions=new Set();
  for(const p of j.positions){
   if(!record(p)||!strings(p,['id','name','color','notes','access','extraWork'])||![p.width,p.height,p.quantity].every(draftNumber)||!number(p.extraCost)||!(p.manualPrice===null||number(p.manualPrice))||!['PVC','ALU'].includes(String(p.material))||!['Dvoslojno','Troslojno','Sigurnosno'].includes(String(p.glass))||!['Standardni','Sigurnosni'].includes(String(p.hardware))||!['Prozori','Vrata','Klizni sistemi','Ulazna vrata','Roletne','Komarnici','Klupice','Usluge'].includes(String(p.category))||!['shutter','mosquito','sill','installation','removal'].every(k=>typeof p[k]==='boolean')||!Array.isArray(p.segments)||p.segments.length<1||p.segments.length>4||positions.has(p.id))return fail();
   positions.add(p.id);
   if(p.fixedPanels!==undefined&&(!record(p.fixedPanels)||p.customGeometry||!["top","bottom","left","right"].every(side=>number((p.fixedPanels as Record<string,unknown>)[side]))))return fail();
   if(p.customInfill!==undefined&&(!p.customGeometry||!['glass','panel'].includes(String(p.customInfill))))return fail();
   if(p.customKind!==undefined&&(!p.customGeometry||!['window','door','other'].includes(String(p.customKind))))return fail();
   if(p.customFrameMm!==undefined&&(!p.customGeometry||!number(p.customFrameMm)||Number(p.customFrameMm)<20||Number(p.customFrameMm)>150))return fail();
   if(p.customGeometry!==undefined&&!isGeometry(p.customGeometry))return fail();
   if(p.elementType==='nacrtaj'&&!isGeometry(p.customGeometry))return fail();
   if(p.customGeometry&&((p.segments as {opening:string}[]).some(s=>s.opening!=='Fiksno')||p.elementType!=='nacrtaj'))return fail();
   if(p.profile!==undefined&&(typeof p.profile!=='string'||p.profile.length>200))return fail();
   if(p.elementType!==undefined&&!['prozor','vrata','balkonska','klizni','fiksni','roletna','komarnik','ostalo','nacrtaj'].includes(String(p.elementType)))return fail();
   if(p.segments.some(s=>!record(s)||!draftNumber(s.width)||!['Fiksno','Levo','Desno','Kip','Levo + kip','Desno + kip','Klizno'].includes(String(s.opening))))return fail();
   if(!Array.isArray(p.photos)||p.photos.length>4||p.photos.some(src=>typeof src!=='string'||!(src==='/assets/house.jpg'||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src))||src.length>650000))return fail();
  }
 }
 const typed=data as unknown as {jobs:(Omit<Job,'status'>&{status:Job['status']|'Čeka proveru'})[];settings:Settings};
 return {...typed,jobs:typed.jobs.map(j=>({...j,status:j.status==='Čeka proveru'?'Ponuda':j.status,createdAt:j.createdAt||j.updated||`${j.date}T12:00:00`,positions:j.positions.map(p=>({...p,profile:p.profile||(p.material==='ALU'?'ALU termo profil':'PVC 70 mm')}))}))};
}
