import { renderToStaticMarkup } from 'react-dom/server';
import type { Job, Position } from '../models';
import { CutListDiagram } from '../custom/CutListDiagram';
import { cutListNotes, elementCutList, specialCutText, type ProfileCut } from '../custom/cut-list';
import { formatAngle } from '../custom/geometry';
import { registerPdfFonts } from './pdf-fonts';

const lengthFormat=new Intl.NumberFormat('sr-Latn-RS',{maximumFractionDigits:1});

async function diagramImage(list:NonNullable<ReturnType<typeof elementCutList>>){
 const svg=renderToStaticMarkup(<CutListDiagram list={list}/>);
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
 try{
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
   const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Skica krojne liste nije dostupna.'));img.src=url;
  });
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=720;
  const context=canvas.getContext('2d');if(!context)throw Error('Skica krojne liste nije dostupna.');
  context.drawImage(image,0,0,1200,720);return canvas.toDataURL('image/png');
 }finally{URL.revokeObjectURL(url);}
}

export async function makeCutListDocument(job:Pick<Job,'id'|'customer'>,position:Position):Promise<File>{
 const list=elementCutList(position);
 if(!list)throw Error('Krojna lista zahteva zatvorenu konturu sa nepravilnim uglovima.');
 const {jsPDF}=await import('jspdf');
 const pdf=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
 await registerPdfFonts(pdf);
 pdf.setProperties({title:`Krojna lista - ${position.name}`,author:'ALU TIM 012',subject:`${job.id} - ${position.id}`});
 let y=0;
 function header(){
  pdf.setFillColor('#710d19');pdf.rect(0,0,210,25,'F');pdf.setTextColor('#fff');
  pdf.setFont('Arial','bold');pdf.setFontSize(17);pdf.text('Krojna lista - ram elementa',15,16);
  pdf.setTextColor('#243039');y=35;
 }
 function ensure(height:number){if(y+height>278){pdf.addPage();header();}}
 function text(value:string,size=9,bold=false){
  pdf.setFont('Arial',bold?'bold':'normal');pdf.setFontSize(size);
  const lines=pdf.splitTextToSize(value,180) as string[];
  for(const line of lines){ensure(6);pdf.text(line,15,y);y+=size*.4+2;}
 }
 header();text(position.name,14,true);text(`${job.id} | Pozicija: ${position.id}`,8);
 text(`Kupac: ${job.customer.name}`,10);
 text(`${position.material} | ${position.profile||'Profil nije naveden'} | Širina rama: ${position.customFrameMm??70} mm`,9);
 text(`Količina elemenata: ${position.quantity} | Profil po spoljnoj ivici`,9);
 ensure(72);pdf.addImage(await diagramImage(list),'PNG',50,y,110,66);y+=71;
 const x=[15,42,79,119,166,195];
 function tableHeader(){
  ensure(12);pdf.setFillColor('#edf4f6');pdf.rect(15,y,180,10,'F');pdf.setFont('Arial','bold');pdf.setFontSize(8);
  ['Profil / krajevi','Dužina (mm)','Rez na početku','Rez na kraju','Kom.'].forEach((label,i)=>pdf.text(label,x[i]+2,y+6));y+=10;
 }
 function cutLines(cut:ProfileCut){
  if(cut.angle===null)return pdf.splitTextToSize(specialCutText(cut),42) as string[];
  return [`${cut.vertex}: ${formatAngle(cut.angle)}`,`Testera: ${formatAngle(cut.saw!)}`,...(cut.concave?['Uvučen spoj']:[])];
 }
 tableHeader();
 for(const row of list.rows){
  pdf.setFont('Arial','normal');pdf.setFontSize(8);
  const start=cutLines(row.start),end=cutLines(row.end);
  const label=[`${row.label}: ${row.from} - ${row.to}`,...(row.kind==='arc'?['Lučni profil']:row.kind==='threshold'?['ALU prag']:[])];
  const length=[lengthFormat.format(row.length),...(row.radius?[`R ${lengthFormat.format(row.radius)}`]:[])];
  const height=Math.max(start.length,end.length,label.length,length.length)*4.5+5;
  if(y+height>278){pdf.addPage();header();text(`${job.id} | ${position.name}`,9,true);tableHeader();}
  pdf.setFont('Arial','normal');pdf.setFontSize(8);pdf.setDrawColor('#d5dfe3');
  [label,length,start,end,[String(row.quantity)]].forEach((lines,i)=>pdf.text(lines,x[i]+2,y+5));
  y+=height;pdf.line(15,y,195,y);
 }
 y+=7;text('Kako čitati listu',10,true);
 cutListNotes.forEach(note=>text(note,8));
 if(list.hasBars)text('Prečke i krila nisu obuhvaćeni ovom listom spoljašnjeg rama.',8);
 if(list.rows.some(row=>row.start.concave||row.end.concave))text('Uvučeni spojevi su posebno označeni. Orijentaciju reza pratite prema skici.',8);
 if(list.rows.some(row=>row.kind!=='frame'))text('Lučni profili i spojevi sa pragom imaju zasebnu obradu prema šablonu ili sistemu profila.',8);
 const pages=pdf.getNumberOfPages();
 for(let page=1;page<=pages;page++){
  pdf.setPage(page);pdf.setFont('Arial','normal');pdf.setFontSize(8);pdf.setTextColor('#667680');
  pdf.text(`ALU TIM 012 | ${job.id}`,15,289);pdf.text(`${page} / ${pages}`,195,289,{align:'right'});
 }
 const safe=(value:string)=>value.replace(/[^a-zA-Z0-9-]/g,'-').slice(0,90);
 return new File([pdf.output('blob')],`${safe(job.id)}-krojna-lista-${safe(position.id)}.pdf`,{type:'application/pdf'});
}
