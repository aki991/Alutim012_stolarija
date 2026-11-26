import type { Position } from './models';
import { centralWidth, noPanels, panelLabels, type PanelSide } from './fixed-panels';
import { panelHeightOf, resizeBand, weightTotal } from './model-layout';
import { openingBoxHeight } from './shutters';
import { portaMaxDimension } from './porta-royal';
import { combinationParts, resizePart, resizePartLeaf, type CombinationPart } from './combination';

export interface PositionDimension {
 id:string; label:string; value:number; min:number; max:number;
 axis:'width'|'height'; x:number; y:number; placement:'outside'|'inside';
}
export const hasDoorDimensions=(p:Position)=>!p.customGeometry&&['Vrata','Ulazna vrata','Sobna vrata','Klizni sistemi'].includes(p.category);
const round=(value:number)=>Math.round(value*100)/100;

/** Field dimensions use the same outer field boundaries as the drawing and specification. */
export function positionDimensions(p:Position):PositionDimension[]{
 if(!hasDoorDimensions(p))return [];
 const box=openingBoxHeight(p),limit=p.modelLayout?20000:p.portaRoyal?portaMaxDimension:3500;
 const result:PositionDimension[]=[
  {id:'width',label:'Ukupna širina',value:p.width,min:p.portaRoyal?1:200,max:p.modelLayout?20000:p.portaRoyal?portaMaxDimension:6000,axis:'width',x:0,y:-box,placement:'outside'},
  {id:'height',label:'Ukupna visina',value:p.height+box,min:(p.portaRoyal?1:200)+box,max:limit+box,axis:'height',x:0,y:-box,placement:'outside'},
 ];
 if(p.portaRoyal)return result;
 if(p.modelLayout){
  const rows=p.modelLayout.rows,total=weightTotal(rows);
  let y=0;
  rows.forEach((row,r)=>{
   const height=p.height*row.weight/total,cellsTotal=weightTotal(row.cells);
   if(rows.length>1)result.push({id:`row:${r}`,label:`Visina reda ${r+1}`,value:height,min:1,max:p.height-(rows.length-1),axis:'height',x:p.width,y,placement:'outside'});
   let x=0;
   row.cells.forEach((cell,c)=>{
    const width=p.width*cell.weight/cellsTotal,label=`${r+1}.${c+1}`;
    if(row.cells.length>1)result.push({id:`cell:${r}:${c}`,label:`Širina polja ${label}`,value:width,min:1,max:p.width-(row.cells.length-1),axis:'width',x,y:y+height,placement:'inside'});
    if(cell.infill==='glassPanel'){
     const panel=panelHeightOf(cell,height),glass=height-panel;
     result.push({id:`glass:${r}:${c}`,label:`Visina stakla ${label}`,value:glass,min:1,max:height-1,axis:'height',x:x+width,y,placement:'inside'});
     result.push({id:`panel:${r}:${c}`,label:`Visina parapeta ${label}`,value:panel,min:1,max:height-1,axis:'height',x:x+width,y:y+glass,placement:'inside'});
    }
    x+=width;
   });
   y+=height;
  });
 }else if(p.combination){
  const c=p.combination,parts=combinationParts(p),doorX=c.windowSide==='left'?parts.windowWidth:0,windowX=c.windowSide==='left'?0:parts.doorWidth;
  const windowBox=openingBoxHeight(p,'window'),windowY=-box+windowBox+(c.alignment==='bottom'?p.height+box-c.windowHeight-windowBox:0);
  for(const part of ['door','window'] as CombinationPart[]){
   const isWindow=part==='window',leaves=parts[part],width=isWindow?parts.windowWidth:parts.doorWidth;
   const x=isWindow?windowX:doorX,bottom=isWindow?windowY+c.windowHeight:p.height,name=isWindow?'prozora':'vrata';
   result.push({id:`part:${part}`,label:`Širina ${name}`,value:width,min:100*leaves.length,max:6000-(isWindow?parts.doorWidth:parts.windowWidth),axis:'width',x,y:bottom,placement:'inside'});
   // Leaf widths sit on their own chain, nearer the element than the part width.
   let leafX=x;
   if(leaves.length>1)leaves.forEach((leaf,index)=>{
    result.push({id:`leaf:${part}:${index}`,label:`Širina krila ${index+1} (${isWindow?'prozor':'vrata'})`,value:leaf.width,min:100,max:width-100,axis:'width',x:leafX,y:bottom+.01,placement:'inside'});leafX+=leaf.width;
   });
  }
  result.push({id:'windowHeight',label:'Visina prozora',value:c.windowHeight+windowBox,min:200+windowBox,max:p.height+box,axis:'height',x:windowX+parts.windowWidth,y:windowY-windowBox,placement:'inside'});
 }else{
  const panels=p.fixedPanels??noPanels,middle=p.height-panels.top-panels.bottom;
  for(const side of ['top','bottom','left','right'] as PanelSide[]){
   const size=panels[side];if(!size)continue;
   const vertical=side==='top'||side==='bottom';
   result.push({id:`fixed:${side}`,label:panelLabels[side],value:size,min:100,max:(vertical?p.height-panels[side==='top'?'bottom':'top']-200:p.width-panels[side==='left'?'right':'left']-100*p.segments.length),axis:vertical?'height':'width',x:side==='right'?p.width-size:vertical?p.width:0,y:side==='bottom'?p.height-size:vertical?0:panels.top,placement:vertical?'outside':'inside'});
  }
  if(panels.top||panels.bottom)result.push({id:'middleHeight',label:'Visina krila',value:middle,min:200,max:p.height,axis:'height',x:p.width,y:panels.top,placement:'outside'});
  let x=panels.left;
  if(p.segments.length>1||panels.left||panels.right)p.segments.forEach((segment,index)=>{
   result.push({id:`segment:${index}`,label:`Širina krila ${index+1}`,value:segment.width,min:100,max:p.segments.length===1?6000-panels.left-panels.right:centralWidth(p.width,panels)-100*(p.segments.length-1),axis:'width',x,y:p.height-panels.bottom,placement:'inside'});x+=segment.width;
  });
 }
 return result.map(d=>({...d,value:round(d.value),max:round(d.max)}));
}

export function resizePosition(p:Position,axis:'width'|'height',value:number):Position{
 if(axis==='height')return {...p,height:value-openingBoxHeight(p)};
 if(p.modelLayout||p.portaRoyal)return {...p,width:value,segments:[{...p.segments[0],width:value}]};
 const old=centralWidth(p.width,p.fixedPanels),next=centralWidth(value,p.fixedPanels);
 return {...p,width:value,segments:p.segments.map(s=>({...s,width:old>0?s.width/old*next:next/p.segments.length}))};
}

export function changePositionDimension(p:Position,id:string,value:number):Position{
 const d=positionDimensions(p).find(d=>d.id===id);
 if(!d||!Number.isFinite(value)||value<d.min||value>d.max)throw Error(`Unesite meru od ${d?.min??1} do ${d?.max??20000} mm.`);
 if(id==='width'||id==='height')return resizePosition(p,id,value);
 const [kind,first,second]=id.split(':'),r=Number(first),c=Number(second);
 if(p.modelLayout){
  const layout=structuredClone(p.modelLayout);
  if(kind==='row')layout.rows=resizeBand(layout.rows,r,value,p.height);
  else if(kind==='cell')layout.rows[r].cells=resizeBand(layout.rows[r].cells,c,value,p.width);
  else{
   const height=p.height*layout.rows[r].weight/weightTotal(layout.rows);
   layout.rows[r].cells[c].panelHeight=kind==='glass'?height-value:value;
  }
  return {...p,modelLayout:layout};
 }
 if(kind==='segment'){
  if(p.segments.length===1)return {...p,width:value+(p.fixedPanels?.left??0)+(p.fixedPanels?.right??0),segments:[{...p.segments[0],width:value}]};
  return {...p,segments:resizeBand(p.segments.map(s=>({...s,weight:s.width})),r,value,centralWidth(p.width,p.fixedPanels)).map(({weight,...s})=>({...s,width:weight}))};
 }
 if(p.combination&&kind==='part')return {...p,...resizePart(p,first as CombinationPart,value)};
 if(p.combination&&kind==='leaf')return {...p,...resizePartLeaf(p,first as CombinationPart,c,value)};
 if(id==='windowHeight')return {...p,combination:{...p.combination!,windowHeight:value-openingBoxHeight(p,'window')}};
 const panels={...(p.fixedPanels??noPanels)};
 if(kind==='fixed')panels[first as PanelSide]=value;
 if(id==='middleHeight'){
  const remainder=p.height-value,previous=panels.top+panels.bottom;
  panels.top=previous?Math.round(remainder*panels.top/previous):remainder;panels.bottom=remainder-panels.top;
 }
 // Preserve the previous proportions of the door wings when a side field changes.
 const total=p.segments.reduce((n,s)=>n+s.width,0),width=centralWidth(p.width,panels);
 return {...p,fixedPanels:panels,segments:p.segments.map(s=>({...s,width:width*s.width/total}))};
}
