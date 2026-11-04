import { bounds, validateGeometry } from '../custom/geometry';
import { centralWidth } from '../fixed-panels';
import type { Job, Package, Position, Settings } from '../models';
export const packages: Record<Package,{factor:number;description:string}> = {
 Standard:{factor:1,description:'Osnovni profil • odabrano staklo i okov'},
 Optimal:{factor:1.12,description:'Pretpostavljeni unapređeni profil • +12% na profil'},
 Premium:{factor:1.28,description:'Pretpostavljeni premium profil • +28% na profil'},
};
export const defaults: Settings = {technician:'Aleksandar Marković',vat:20,vatMode:'exclusive',prices:{PVC:110,ALU:175,Dvoslojno:32,Troslojno:52,Sigurnosno:68,hardware:24,secureHardware:42,shutter:48,mosquito:26,sill:16,installation:9,removal:6,transport:35}};
export const euro = (n:number) => new Intl.NumberFormat('sr-Latn-RS',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(n);
export function positionCost(p:Position,s:Settings,tier:Package='Standard') {
 if(p.customGeometry){const unit=p.manualPrice??0;return {area:0,perimeter:0,lines:[] as {name:string;basis:string;amount:number}[],calculated:0,unit,total:unit*p.quantity,requiresReview:p.manualPrice===null};}
 const area=p.width*p.height/1e6, perimeter=2*(p.width+p.height)/1000, pr=s.prices;
 const lines: {name:string;basis:string;amount:number}[]=[];
 if (['Roletne','Komarnici','Klupice','Usluge'].includes(p.category)) {
  const rate=p.category==='Roletne'?pr.shutter:p.category==='Komarnici'?pr.mosquito:pr.sill;
  const basis=p.category==='Klupice'?p.width/1000:area;
  if(p.category!=='Usluge')lines.push({name:p.category,basis:`${basis.toFixed(2)} ${p.category==='Klupice'?'m':'m²'} × ${rate} €`,amount:basis*rate});
 } else {
  lines.push({name:`${p.material} profil · ${tier}`,basis:`${area.toFixed(2)} m² × ${pr[p.material]} € × ${packages[tier].factor}`,amount:area*pr[p.material]*packages[tier].factor});
  lines.push({name:p.glass+' staklo',basis:`${area.toFixed(2)} m² × ${pr[p.glass]} €`,amount:area*pr[p.glass]});
  const wings=p.segments.filter(x=>x.opening!=='Fiksno').length;
  lines.push({name:'Okov',basis:`${wings} krila × ${p.hardware==='Sigurnosni'?pr.secureHardware:pr.hardware} €`,amount:wings*(p.hardware==='Sigurnosni'?pr.secureHardware:pr.hardware)});
 }
 if(p.shutter)lines.push({name:'Roletna',basis:`${area.toFixed(2)} m² × ${pr.shutter} €`,amount:area*pr.shutter});
 if(p.mosquito)lines.push({name:'Komarnik',basis:`${area.toFixed(2)} m² × ${pr.mosquito} €`,amount:area*pr.mosquito});
 if(p.sill)lines.push({name:'Klupica',basis:`${(p.width/1000).toFixed(2)} m × ${pr.sill} €`,amount:p.width/1000*pr.sill});
 if(p.installation)lines.push({name:'Montaža',basis:`${perimeter.toFixed(2)} m × ${pr.installation} €`,amount:perimeter*pr.installation});
 if(p.removal)lines.push({name:'Demontaža',basis:`${perimeter.toFixed(2)} m × ${pr.removal} €`,amount:perimeter*pr.removal});
 if(p.extraCost)lines.push({name:p.extraWork||'Dodatni radovi',basis:'paušal',amount:p.extraCost});
 const calculated=lines.reduce((a,b)=>a+b.amount,0), unit=p.manualPrice??calculated;
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
 if(p.customGeometry){const frame=p.customFrameMm??70;if(!Number.isFinite(frame)||frame<20||frame>150)errors.push('Širina rama mora biti između 20 i 150 mm.');if(Math.min(p.width,p.height)<=2*frame)errors.push('Ram je preširok za zadate mere elementa.');errors.push(...validateGeometry(p.customGeometry));const b=bounds(p.customGeometry);if(b.width<200||b.height<200||b.width>20000||b.height>20000)errors.push('Širina i visina oblika moraju biti između 200 i 20000 mm.');if(Math.abs(p.width-b.width)>.001||Math.abs(p.height-b.height)>.001)errors.push('Sačuvane mere ne odgovaraju geometriji.');if(!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>100)errors.push('Količina mora biti ceo broj od 1 do 100.');if(p.segments.some(s=>s.opening!=='Fiksno'))errors.push('Nepravilni elementi podržavaju samo fiksno zastakljenje.');return errors;}
 if(!Number.isFinite(p.width)||p.width<200||p.width>6000)errors.push('Širina mora biti između 200 i 6000 mm.');
 if(!Number.isFinite(p.height)||p.height<200||p.height>3500)errors.push('Visina mora biti između 200 i 3500 mm.');
 if(!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>100)errors.push('Količina mora biti ceo broj od 1 do 100.');
 const panels=p.fixedPanels;
 if(panels&&Object.values(panels).some(value=>!Number.isInteger(value)||value<0||value>0&&value<100))errors.push('Fiksno polje mora imati najmanje 100 mm.');
 if(panels&&p.height-panels.top-panels.bottom<200)errors.push('Između gornjeg i donjeg polja mora ostati najmanje 200 mm.');
 if(panels?.bottom&&(p.category==='Vrata'||p.category==='Ulazna vrata'||p.elementType==='balkonska'))errors.push('Vrata ne mogu imati donje fiksno polje.');
 if(Math.abs(p.segments.reduce((sum,s)=>sum+s.width,0)-centralWidth(p.width,panels))>1)errors.push('Zbir širina segmenata mora odgovarati ukupnoj širini.');
 if(p.segments.some(s=>!Number.isFinite(s.width)||s.width<100))errors.push('Svaki segment mora biti širok najmanje 100 mm.');
 return errors;
}

export const reviewPrice='Cena zahteva proveru u kancelariji';
export function positionPriceLabel(p:Position,amount:number){return p.customGeometry&&p.manualPrice===null?'Za proveru':euro(amount);}
export function jobPriceLabel(job:Job,settings:Settings){const c=calculate(job,settings);return c.hasUnpriced?'Cena za proveru':euro(c.total);}
