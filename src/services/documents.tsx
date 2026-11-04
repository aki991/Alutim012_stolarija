import { panelLabels, type PanelSide } from '../fixed-panels';
import { hingeLabel, openingRegions } from '../custom/openings';
import { customKindLabel, customInfillOf } from '../models';
import { edgeArc, edgeLength, ends, fmt } from '../custom/geometry';
import { renderToStaticMarkup } from 'react-dom/server';
import type { jsPDF as PDF } from 'jspdf';
import type { Job, Position, Settings } from '../models';
import { Drawing } from '../components/Drawing';
import { calculate, jobTax, euro, positionCost, validatePosition, reviewPrice } from './calculation';
const base64=(bytes:Uint8Array)=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
let fonts:Promise<string[]>|undefined;
function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Slika nije dostupna. Proverite podatke o fotografijama.'));i.src=src;});}
async function drawingImage(p:Position){const svg=renderToStaticMarkup(<Drawing position={p}/>).replace(/style="[^"]*"/,'').replace('<svg ','<svg width="920" height="730" ');const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);try{const i=await loadImage(url),c=document.createElement('canvas');c.width=920;c.height=730;c.getContext('2d')!.drawImage(i,0,0,920,730);return c.toDataURL('image/png');}finally{URL.revokeObjectURL(url);}}
async function logoImage(){const img=await loadImage('/assets/reference.png');const c=document.createElement('canvas');c.width=508;c.height=162;c.getContext('2d')!.drawImage(img,1387,329,254,81,0,0,508,162);return c.toDataURL('image/png');}
export async function makeDocument(job:Job,settings:Settings,kind:'kupac'|'kancelarija'):Promise<File> {
 if(!job.positions.length)throw Error('Dodajte najmanje jednu poziciju.');
 if(job.positions.some(p=>validatePosition(p).length))throw Error('Proverite mere i zbir segmenata u specifikaciji pre izvoza.');
 const showPrices=settings.showPrices!==false;
 const taxSettings=jobTax(job,settings);const {jsPDF}=await import('jspdf');const doc:PDF=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
 fonts??=Promise.all(['/assets/arial.ttf','/assets/arial-bold.ttf'].map(async path=>{const response=await fetch(path);if(!response.ok)throw Error('Font za PDF nije dostupan.');return base64(new Uint8Array(await response.arrayBuffer()));}));
 try{const [normal,bold]=await fonts;doc.addFileToVFS('Arial.ttf',normal);doc.addFont('Arial.ttf','Arial','normal');doc.addFileToVFS('ArialBold.ttf',bold);doc.addFont('ArialBold.ttf','Arial','bold');}catch(err){fonts=undefined;throw err;}
 const logo=await logoImage();doc.setProperties({title:`${kind==='kupac'?'Ponuda':'Specifikacija'} ${job.id}`,author:'ALU TIM 012',subject:'Demonstraciona terenska specifikacija'});
 const emblemResponse = await fetch('/assets/logo.png');
 if (!emblemResponse.ok) throw Error('Logo za PDF nije dostupan.');
 const emblem = new Uint8Array(await emblemResponse.arrayBuffer());
 const title=kind==='kupac'?'Ponuda za kupca':'Specifikacija za kancelariju';let y=0;
 function header(){doc.setFillColor('#590c14');doc.rect(0,0,210,33,'F');doc.addImage(emblem,'PNG',16,4.5,24,24);doc.addImage(logo,'PNG',45,7,55,17.5);doc.setFont('Arial','normal');doc.setTextColor('#ffffff');doc.setFontSize(9);doc.text('ALU & PVC STOLARIJA',194,15,{align:'right'});doc.setFontSize(8);doc.text('TERENSKA SPECIFIKACIJA',194,22,{align:'right'});y=45;doc.setTextColor('#243039');}
 const ensure=(height:number)=>{if(y+height>276){doc.addPage();header();}};
 function text(value:string,size=9,bold=false,indent=16,width=178){doc.setFont('Arial',bold?'bold':'normal');doc.setFontSize(size);const lines=doc.splitTextToSize(String(value||'-'),width) as string[];for(const line of lines){ensure(size*.5+2);doc.text(line,indent,y);y+=size*.44+1.8;}}
 function rule(){ensure(5);doc.setDrawColor('#e0e4e6');doc.line(16,y,194,y);y+=6;}
 header();text(title,21,true);text(`${job.id}  |  Datum merenja: ${job.date?new Date(job.date+'T12:00:00').toLocaleDateString('sr-Latn-RS'):'Nije naveden'}`,9);y+=3;
 text(job.customer.name,12,true);text(job.customer.address);text(`Telefon: ${job.customer.phone||'-'}  |  Email: ${job.customer.email||'-'}`);text(`Objekat: ${job.customer.building}  |  Majstor: ${job.technician}`);
 if(showPrices)text(`Demo paket: ${job.package}. Cene su ${taxSettings.vatMode==='inclusive'?'sa uključenim PDV-om':taxSettings.vatMode==='exclusive'?'bez PDV-a; porez se dodaje u pregledu':'bez obračuna PDV-a'}.`,8);rule();
 const c=calculate(job,settings);
 for(let i=0;i<job.positions.length;i++){
  const p=job.positions[i],price=positionCost(p,settings,job.package);ensure(88);text(`${String(i+1).padStart(2,'0')}  ${p.name}`,11,true);const start=y;
  doc.addImage(await drawingImage(p),'PNG',15,start,69,55);y=start+5;
  text(`${fmt(p.width)} × ${fmt(p.height)} mm  |  ${p.quantity} kom`,10,true,88,104);text(`${p.material} · ${p.profile||(p.material==='PVC'?'PVC 70 mm':'ALU termo profil')}, ${p.color}`,9,false,88,104);text(p.customGeometry?`${customInfillOf(p)==='panel'?'Puni panel':p.glass+' staklo'}, ${customKindLabel(p.customKind).toLowerCase()}`:`${p.glass} staklo, ${p.hardware.toLowerCase()} okov`,9,false,88,104);
  const extras=[p.shutter?'roletna':'',p.mosquito?'komarnik':'',p.sill?'klupica':'',p.installation?'montaža':'',p.removal?'demontaža':''].filter(Boolean).join(', ');
  if(extras)text(`Uključeno: ${extras}`,8,false,88,104);
  if(showPrices){if(price.requiresReview)text(reviewPrice,10,true,88,104);else{text(`${p.customGeometry?'Ručno / kom':'Jedinično'}: ${euro(price.unit)}`,9,false,88,104);text(`Ukupno: ${euro(price.total)}`,10,true,88,104);}}y=Math.max(y,start+58);
  if(p.customGeometry?.openings?.length){
   const marks=p.customGeometry.openings;
   const openings=openingRegions(p.customGeometry).map((region,index)=>{
    const mark=marks.find(mark=>mark.region===region.id);
    return mark?`Polje ${index+1}: ${hingeLabel(mark.side)}`:'';
   }).filter(Boolean);
   if(openings.length)text(`Otvaranje (pogled kao na crtežu): ${openings.join(', ')}.`,9,true);
  }
  if(p.customGeometry)text('Terenska skica — potrebna tehnička provera',9,true);
  if(p.extraWork)text(`Dodatni radovi: ${p.extraWork}${showPrices?` (${euro(p.extraCost)} / kom)`:''}`);
  if(p.combination){
   text(`Vrata: ${fmt(p.segments[0].width)} × ${fmt(p.height)} mm / ${p.segments[0].opening}`,9);
   text(`Prozor ${p.combination.windowSide==='left'?'levo':'desno'}: ${fmt(p.segments[1].width)} × ${fmt(p.combination.windowHeight)} mm / ${p.segments[1].opening}`,9);
   text(`Poravnanje: ${p.combination.alignment==='top'?'gornja ivica':'donja ivica'}`,9);
  }
  if(kind==='kancelarija'){
   if(p.fixedPanels){
    const panels=p.fixedPanels;
    const labels=(Object.keys(panelLabels) as PanelSide[]).filter(side=>panels[side]>0).map(side=>`${panelLabels[side]} ${panels[side]} mm`);
    if(labels.length)text(labels.join(' · '),9);
   }
   if(!p.customGeometry&&!p.combination)text(`Krila: ${p.segments.map((s,k)=>`${k+1}: ${Math.round(s.width)} mm / ${s.opening}`).join('; ')}`,9);
   if(p.customGeometry){const g=p.customGeometry;text(`Geometrija u mm. ${customKindLabel(p.customKind)}. Širina rama: ${p.customFrameMm??70} mm. Otvaranje za tehničku proveru.`,9,true);for(let k=0;k<g.edges.length;k++){const e=g.edges[k],[a,b]=ends(g,e);text(`${k+1}. ${e.kind==='arc'?'Luk':'Linija'}: (${fmt(a.x)}; ${fmt(a.y)}) → (${fmt(b.x)}; ${fmt(b.y)}), dužina ${fmt(edgeLength(g,e))} mm`,8);if(e.kind==='arc'){const arc=edgeArc(g,e);text(`R ${fmt(arc.radius)} mm; centar (${fmt(arc.center.x)}; ${fmt(arc.center.y)}); kontrolna tačka (${fmt(e.via!.x)}; ${fmt(e.via!.y)})`,8);}}for(let k=0;k<g.bars.length;k++){const b=g.bars[k];text(`Prečka ${k+1}: (${fmt(b.a.x)}; ${fmt(b.a.y)}) → (${fmt(b.b.x)}; ${fmt(b.b.y)}) mm`,8);}}
   if(p.notes)text('Napomena: '+p.notes);if(p.access)text('Pristup i uslovi: '+p.access);
   text(`Montaža: ${p.installation?'DA':'NE'}  |  Demontaža: ${p.removal?'DA':'NE'}`);
   if(showPrices){if(!p.customGeometry)text('Obračun po komadu:',8,true);for(const line of price.lines)text(`${line.name}: ${line.basis} = ${euro(line.amount)}`,8);
   if(p.manualPrice!==null)text(p.customGeometry?`Ručna okvirna cena: ${euro(p.manualPrice)} / kom. Potrebna provera u kancelariji.`:`Ručna korekcija: ${euro(p.manualPrice)} / kom (umesto ${euro(price.calculated)})`,8,true);}
   for(let k=0;k<p.photos.length;k++){const src=p.photos[k];ensure(76);text(`Fotografija ${k+1}${src.startsWith('/assets')?' - demonstraciona ilustracija objekta':''}`,8);const img=await loadImage(src),ratio=Math.min(172/img.naturalWidth,65/img.naturalHeight);const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;cv.getContext('2d')!.drawImage(img,0,0);const height=img.naturalHeight*ratio;doc.addImage(cv.toDataURL('image/jpeg',.8),'JPEG',16,y, img.naturalWidth*ratio,height);y+=height+7;}
  }
  rule();
 }
 if(showPrices){ensure(88);if(c.hasUnpriced)text(reviewPrice+'. Elementi bez ručne cene nisu uključeni u zbir.',10,true);text(c.hasUnpriced?'Zbir poznatih stavki':'Okvirna cena',15,true);text(`Elementi sa odabranom opremom i radovima: ${euro(c.elements)}`);text(`Transport: ${euro(job.transport)}`);if(job.extraCost||job.extraWork)text(`Dodatni radovi: ${job.extraWork||'-'} - ${euro(job.extraCost)}`);if(c.manual)text('Ručna ukupna cena (konačan iznos); popust i uvećanje se ne primenjuju.',9,true);else {text(`Popust ${job.discountMode==='amount'?'':job.discount+'%'}: -${euro(c.discount)}`);if(c.surcharge)text(`Uvećanje: ${euro(c.surcharge)}`);}text(`Osnovica: ${euro(c.net)}`);text(taxSettings.vatMode==='none'?'PDV: bez obračuna':`PDV ${taxSettings.vat}%${taxSettings.vatMode==='inclusive'?' (uključen)':''}: ${euro(c.tax)}`);text(`${c.hasUnpriced?'Nepotpun zbir poznatih stavki':'Ukupan okvirni iznos'}: ${euro(c.total)}`,13,true);y+=4;}
 if(!showPrices&&job.extraWork)text('Dodatni radovi: '+job.extraWork);
 if(job.notes)text('Napomena za posao: '+job.notes);
 if(kind==='kupac'){text(`Važenje ponude: ${job.validity}`);text(`Rok isporuke: ${job.delivery}`);text(`Plaćanje: ${job.payment}`);}else{text('Status: ZA DALJU TEHNIČKU PROVERU',10,true);text(`Evidentirani status posla: ${job.status}`);text('Potrebno je potvrditi završne mere, profile, raspored krila i uslove proizvodnje i montaže.');}
 y+=3;text('DEMONSTRACIONI DOKUMENT. '+(showPrices?'Cene nisu zvanične cene firme. Ovo je okvirna procena, a ne proizvodna kalkulacija. ':'')+'Crteži služe za terensku specifikaciju i nisu proizvodno verifikovani.',8);
 const pageCount=doc.getNumberOfPages();for(let n=1;n<=pageCount;n++){doc.setPage(n);doc.setFont('Arial','normal');doc.setFontSize(7);doc.setTextColor('#889096');doc.text(`ALU TIM 012  |  ${job.id}  |  Demonstracioni dokument`,16,288);doc.text(`${n} / ${pageCount}`,194,288,{align:'right'});}
 return new File([doc.output('blob')],`${job.id}-${kind==='kupac'?'ponuda':'specifikacija'}.pdf`,{type:'application/pdf'});
}
export function downloadFile(file:File){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
