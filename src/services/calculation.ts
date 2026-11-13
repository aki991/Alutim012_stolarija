import { bounds, validateGeometry } from '../custom/geometry';
import { centralWidth } from '../fixed-panels';
import { isModelLayout, maxModelDimension, type Movement } from '../model-layout';
import type { Job, Package, Position, Settings } from '../models';
import { openingBoxHeight, shutterMeasures, shutterTypes } from '../shutters';
import { isPortaDimension, isPortaRoyalConfig, portaSeriesById } from '../porta-royal';
import { positionMeasures } from './position-measures';
import { supplementLabels, supplementRates, type SupplementRate } from './pricing-rates';
export const packages: Record<Package,{factor:number;description:string}> = {
 Standard:{factor:1,description:'Osnovni profil • odabrano staklo i okov'},
 Optimal:{factor:1.12,description:'Pretpostavljeni unapređeni profil • +12% na profil'},
 Premium:{factor:1.28,description:'Pretpostavljeni premium profil • +28% na profil'},
};
export const defaults: Settings = {technician:'Aleksandar Marković',vat:20,vatMode:'exclusive',prices:{PVC:110,ALU:175,Dvoslojno:32,Troslojno:52,Sigurnosno:68,hardware:24,secureHardware:42,shutter:48,mosquito:26,sill:16,installation:9,removal:6,transport:35,marginPercent:0,...supplementRates}};
export const euro = (n:number) => new Intl.NumberFormat('sr-Latn-RS',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(n);
const measure=new Intl.NumberFormat('sr-Latn-RS',{maximumFractionDigits:3});
const movementRates:Partial<Record<Movement,SupplementRate>>={
 tilt:'tiltHardware',tiltLeft:'tiltHardware',tiltRight:'tiltHardware',
 slideLeft:'slideHardware',slideRight:'slideHardware',slideUp:'slideHardware',slideDown:'slideHardware',
 foldLeft:'foldHardware',foldRight:'foldHardware',pivotH:'pivotHardware',pivotV:'pivotHardware',pivotVLeft:'pivotHardware',pivotVRight:'pivotHardware',
 awning:'specialHardware',outBottom:'specialHardware',projected:'specialHardware',parallel:'specialHardware',doubleLeft:'specialHardware',doubleRight:'specialHardware',louvre:'specialHardware',
};
const systemRates:[RegExp,SupplementRate][]=[
 [/^Podizno-klizni/i,'liftSlide'],[/^Otklopno-klizni/i,'tiltSlide'],[/^Odmično-klizni/i,'retractSlide'],
 [/teleskopska|teleskopski|panoramski klizni/i,'multiTrack'],[/zidni džep/i,'pocket'],
 [/^Motorna|^Brza rolo industrijska/i,'motor'],[/^Automatska/i,'automaticDoor'],[/^Rotirajuća/i,'revolvingDoor'],
 [/garažna vrata|industrijska vrata/i,'garageMechanism'],[/^Protivpožarna|^Protivprovalna|antipanik/i,'certifiedDoor'],
];

export function positionCost(p:Position,s:Settings,tier:Package='Standard') {
 const lines: {name:string;basis:string;amount:number}[]=[];
 const measures=positionMeasures(p);
 const portaRate=p.portaRoyal?s.portaRoyalPrices?.[p.portaRoyal.series]:undefined;
 if(!measures||p.portaRoyal&&portaRate===undefined){const unit=p.manualPrice??0;return {area:measures?.area??0,perimeter:measures?.perimeter??0,lines,calculated:0,unit,total:unit*p.quantity,requiresReview:p.manualPrice===null};}
 const {area,perimeter}=measures,pr=s.prices;
 const shutterRate=(p.shutterConfig&&pr[shutterTypes[p.shutterConfig.type].rate])??pr.shutter;
 const rateOf=(key:SupplementRate)=>pr[key]??supplementRates[key];
 const addSupplement=(key:SupplementRate,quantity:number)=>{
  if(quantity<=0)return;
  const [name,unit]=supplementLabels[key],rate=rateOf(key);
  lines.push({name,basis:`${measure.format(quantity)} ${unit==='krilo'&&quantity!==1?'krila':unit} × ${euro(rate)}`,amount:quantity*rate});
 };
 if(p.portaRoyal&&portaRate!==undefined){
  lines.push({name:`Porta Royal ${portaSeriesById(p.portaRoyal.series)!.name}`,basis:`1 kom. × ${euro(portaRate)}`,amount:portaRate});
 } else if (['Roletne','Komarnici','Klupice','Usluge'].includes(p.category)) {
  const rate=p.category==='Roletne'?shutterRate:p.category==='Komarnici'?pr.mosquito:pr.sill;
  const basis=p.category==='Klupice'?p.width/1000:area;
  if(p.category==='Usluge')addSupplement('service',1);
  else lines.push({name:p.category,basis:`${basis.toFixed(2)} ${p.category==='Klupice'?'m':'m²'} × ${rate} €`,amount:basis*rate});
 } else {
  const profile=p.profile?.startsWith(p.material)?p.profile:p.material==='PVC'?'PVC 70 mm':'ALU termo profil';
  const profileKey=profile==='PVC 76 mm'?'pvc76':profile==='PVC 82 mm'?'pvc82':profile==='ALU hladni profil'?'aluCold':null;
  const profileRate=profileKey?rateOf(profileKey):pr[p.material];
  const profileCost=area*profileRate*packages[tier].factor;
  lines.push({name:`${profile} · ${tier}`,basis:`${area.toFixed(2)} m² × ${profileRate} € × ${packages[tier].factor}`,amount:profileCost});
  if(p.color&&p.color!=='Bela')lines.push({name:`Boja profila · ${p.color}`,basis:`${euro(profileCost)} × ${rateOf('profileColor')}%`,amount:profileCost*rateOf('profileColor')/100});
  if(measures.glass>0)lines.push({name:p.glass+' staklo',basis:`${measures.glass.toFixed(2)} m² × ${pr[p.glass]} €`,amount:measures.glass*pr[p.glass]});
  addSupplement('panel',measures.panel);
  addSupplement('louvres',measures.louvres);
  addSupplement('divider',measures.divider);
  addSupplement(p.material==='PVC'?'bendPVC':'bendALU',measures.bend);
  if(measures.shaped)addSupplement('shapedInfill',1);
  const wings=measures.moves.filter(move=>move!=='fixed').length;
  const hardwareRate=p.hardware==='Sigurnosni'?pr.secureHardware:pr.hardware;
  lines.push({name:'Okov',basis:`${wings} ${wings===1?'krilo':'krila'} × ${hardwareRate} €`,amount:wings*hardwareRate});
  const counts=new Map<SupplementRate,number>();
  for(const move of measures.moves){const rate=movementRates[move];if(rate)counts.set(rate,(counts.get(rate)??0)+1);}
  for(const [rate,count] of counts)addSupplement(rate,count);
  if(p.modelLayout&&wings)for(const [match,rate] of systemRates)if(match.test(p.modelLayout.system))addSupplement(rate,1);
 }
 if(p.shutter&&p.category!=='Roletne'){
  const shutter=p.shutterConfig&&shutterMeasures(p,p.shutterConfig);
  const shutterArea=shutter?shutter.width*shutter.totalHeight/1e6:area;
  lines.push({name:'Roletna',basis:`${shutterArea.toFixed(2)} m² × ${shutterRate} €`,amount:shutterArea*shutterRate});
 }
 if(p.mosquito)lines.push({name:'Komarnik',basis:`${area.toFixed(2)} m² × ${pr.mosquito} €`,amount:area*pr.mosquito});
 if(p.sill)lines.push({name:'Klupica',basis:`${(p.width/1000).toFixed(2)} m × ${pr.sill} €`,amount:p.width/1000*pr.sill});
 if(p.installation)lines.push({name:'Montaža',basis:`${perimeter.toFixed(2)} m × ${pr.installation} €`,amount:perimeter*pr.installation});
 if(p.removal)lines.push({name:'Demontaža',basis:`${perimeter.toFixed(2)} m × ${pr.removal} €`,amount:perimeter*pr.removal});
 if(p.extraCost)lines.push({name:p.extraWork||'Dodatni radovi',basis:'paušal',amount:p.extraCost});
 const baseCents=Math.round(lines.reduce((total,line)=>total+line.amount,0)*100);
 const marginPercent=pr.marginPercent??0;
 const marginCents=Math.round(baseCents*marginPercent/100);
 if(marginPercent>0)lines.push({name:'Marža',basis:`${euro(baseCents/100)} × ${measure.format(marginPercent)}%`,amount:marginCents/100});
 const calculated=(baseCents+marginCents)/100;
 const unit=p.manualPrice??calculated;
 return {area,perimeter,lines,calculated,unit,total:unit*p.quantity,requiresReview:false};
}
export function jobTax(job:Job,s:Settings){return {vat:job.vat??s.vat,vatMode:job.vatMode??s.vatMode};}
export function calculate(job:Job,s:Settings) {
 const positions=job.positions.map(p=>positionCost(p,s,job.package));
 const elements=positions.reduce((sum,p)=>sum+p.total,0),services=job.transport+job.extraCost;
 const subtotal=elements+services,manual=job.manualTotal!=null;
 // Discounts apply to the original subtotal; increases apply after the discount.
 // A manual total is the final payable amount, including tax when applicable.
 const discount=manual?0:Math.min(subtotal,job.discountMode==='amount'?job.discount:subtotal*job.discount/100);
 const discounted=subtotal-discount;
 const surcharge=manual?0:job.surchargeMode==='amount'?(job.surcharge??0):discounted*(job.surcharge??0)/100;
 const after=discounted+surcharge,{vat,vatMode}=jobTax(job,s);
 const net=manual?(vatMode==='none'?job.manualTotal!:job.manualTotal!/(1+vat/100)):vatMode==='inclusive'?after/(1+vat/100):after;
 const tax=vatMode==='none'?0:manual?job.manualTotal!-net:vatMode==='inclusive'?after-net:net*vat/100;
 return {positions,elements,services,subtotal,discount,surcharge,net,tax,total:manual?job.manualTotal!:net+tax,manual,vat,vatMode,hasUnpriced:!manual&&positions.some(p=>p.requiresReview)};
}
export function validatePosition(p:Position):string[] {
 const errors:string[]=[];
 if(p.portaRoyal){
  if(!isPortaRoyalConfig(p.portaRoyal))errors.push('Proverite seriju, dekor, tip i opremu sobnih vrata.');
  if(!p.name.trim())errors.push('Unesite naziv pozicije.');
  if(![p.width,p.height].every(isPortaDimension))errors.push('Unesite širinu i visinu otvora u milimetrima.');
  if(!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>100)errors.push('Količina mora biti ceo broj od 1 do 100.');
  return errors;
 }
 if(p.shutterConfig){
  const {boxHeight,mount}=p.shutterConfig;
  const {frameHeight}=shutterMeasures(p,p.shutterConfig);
  if(p.category==='Roletne'&&boxHeight>=p.height)errors.push('Visina kutije mora biti manja od ukupne visine roletne.');
  else if(p.shutter&&mount==='overlay'&&boxHeight>=frameHeight)errors.push('Visina kutije mora biti manja od visine rama.');
  else if(p.shutter&&mount==='inside'&&frameHeight<200)errors.push('Posle odbitka kutije mora ostati najmanje 200 mm visine rama.');
 }
 if(p.modelLayout){
  if(![p.width,p.height].every(n=>Number.isFinite(n)&&n>=200&&n<=maxModelDimension))errors.push(`Širina i visina moraju biti između 200 i ${maxModelDimension} mm.`);
  if(!isModelLayout(p.modelLayout)||p.modelLayout.rows.every(row=>row.cells.every(cell=>cell.infill==='space')))errors.push('Proverite raspored polja.');
  if(!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>100)errors.push('Količina mora biti ceo broj od 1 do 100.');
  return errors;
 }
 if(p.customGeometry){const frame=p.customFrameMm??70;if(!Number.isFinite(frame)||frame<20||frame>150)errors.push('Širina rama mora biti između 20 i 150 mm.');if(Math.min(p.width,p.height)<=2*frame)errors.push('Ram je preširok za zadate mere elementa.');errors.push(...validateGeometry(p.customGeometry));const b=bounds(p.customGeometry);if(b.width<200||b.height<200||b.width>20000||b.height>20000)errors.push('Širina i visina oblika moraju biti između 200 i 20000 mm.');if(Math.abs(p.width-b.width)>.001||Math.abs(p.height-b.height)>.001)errors.push('Sačuvane mere ne odgovaraju geometriji.');if(!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>100)errors.push('Količina mora biti ceo broj od 1 do 100.');return errors;}
 if(!Number.isFinite(p.width)||p.width<200||p.width>6000)errors.push('Širina mora biti između 200 i 6000 mm.');
 if(!Number.isFinite(p.height)||p.height<200||p.height>3500)errors.push('Visina mora biti između 200 i 3500 mm.');
 if(p.combination&&(!Number.isInteger(p.combination.windowHeight)||p.combination.windowHeight<200||p.combination.windowHeight+openingBoxHeight(p,'window')>p.height+openingBoxHeight(p)))errors.push('Visina prozora mora biti najmanje 200 mm, a otvor za prozor najviše visok kao otvor za vrata.');
 if(!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>100)errors.push('Količina mora biti ceo broj od 1 do 100.');
 const panels=p.fixedPanels;
 if(panels&&Object.values(panels).some(value=>!Number.isInteger(value)||value<0||value>0&&value<100))errors.push('Fiksno polje mora imati najmanje 100 mm.');
 if(panels&&p.height-panels.top-panels.bottom<200)errors.push('Između gornjeg i donjeg polja mora ostati najmanje 200 mm.');
 if(panels?.bottom&&(p.category==='Vrata'||p.category==='Ulazna vrata'||p.elementType==='balkonska'))errors.push('Vrata ne mogu imati donje fiksno polje.');
 if(Math.abs(p.segments.reduce((sum,s)=>sum+s.width,0)-centralWidth(p.width,panels))>1)errors.push('Zbir širina segmenata mora odgovarati ukupnoj širini.');
 if(p.segments.some(s=>!Number.isFinite(s.width)||s.width<100))errors.push('Svaki segment mora biti širok najmanje 100 mm.');
 return errors;
}

export const reviewPrice='Proverite mere elementa';
export const positionReviewLabel=(p?:Position)=>p?.portaRoyal?'Cena po upitu':reviewPrice;
export function positionPriceLabel(price:ReturnType<typeof positionCost>,p?:Position){return price.requiresReview?positionReviewLabel(p):euro(price.total);}
export function jobReviewLabel(job:Job,calc:ReturnType<typeof calculate>){return job.positions.some((position,i)=>position.portaRoyal&&calc.positions[i].requiresReview)?'Neke stavke čekaju potvrdu cene':reviewPrice;}
export function jobPriceLabel(job:Job,settings:Settings){const c=calculate(job,settings);return c.hasUnpriced?'Cena za proveru':euro(c.total);}
