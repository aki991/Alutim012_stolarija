import type { Position } from './models';
import { positionDimensions, type PositionDimension } from './position-dimensions';
import { weightTotal } from './model-layout';
import { partWidth } from './combination';

export interface DimensionPlacement {
 dimension:PositionDimension; x:number; y:number; length:number;
 labelX:number; labelY:number; anchor:'start'|'middle'|'end';
 extensions:string; caption?:string; captionY?:number; outer:boolean;
}
export interface DimensionBounds {left:number;right:number;top:number;bottom:number}

/** Arrange dimension chains outside the product, with a separate lane for each field. */
export function layoutDimensions(p:Position,origin:{x:number;y:number},scale:number){
 const dimensions=positionDimensions(p),placements:DimensionPlacement[]=[];
 const left=origin.x,right=left+p.width*scale,top=origin.y,bottom=top+p.height*scale;
 const lanes:{left:{start:number;end:number}[][];right:{start:number;end:number}[][]}={left:[],right:[]};
 const chainLanes=new Map<string,{side:'left'|'right';lane:number}>();
 const internal=dimensions.filter(d=>d.axis==='height'&&d.placement==='inside');
 const chainKeys=[...new Set(internal.map(d=>d.id.replace(/^(glass|panel):/,'')))];
 for(const key of chainKeys){
  const chain=internal.filter(d=>d.id.replace(/^(glass|panel):/,'')===key),first=chain[0];
  let center=first.x;
  if(p.modelLayout){
   const [r,c]=key.split(':').map(Number),row=p.modelLayout.rows[r];
   if(row)center-=p.width*row.cells[c].weight/weightTotal(row.cells)/2;
  }else if(p.combination)center-=partWidth(p,'window')/2;
  const side=chainKeys.length===1||center>=p.width/2?'right':'left';
  const start=Math.min(...chain.map(d=>d.y)),end=Math.max(...chain.map(d=>d.y+d.value));
  let lane=lanes[side].findIndex(intervals=>intervals.every(i=>end<i.start-80||start>i.end+80));
  if(lane<0){lane=lanes[side].length;lanes[side].push([]);}
  lanes[side][lane].push({start,end});chainLanes.set(key,{side,lane});
 }
 const widths=dimensions.filter(d=>d.axis==='width'&&d.id!=='width');
 const widthLevels=[...new Set(widths.map(d=>Math.round(d.y*100)/100))].sort((a,b)=>b-a);
 for(const d of dimensions){
  const outer=d.id==='width'||d.id==='height',vertical=d.axis==='height';
  const length=d.value*scale,startX=left+d.x*scale,startY=top+d.y*scale;
  let x=startX,y=startY,anchor:'start'|'middle'|'end'='middle',labelX=x,labelY=y,extensions='',caption:string|undefined,captionY:number|undefined;
  if(!vertical){
   y=outer?startY-28:bottom+30+widthLevels.indexOf(Math.round(d.y*100)/100)*32;
   labelX=x+length/2;labelY=y-10;
   const edge=outer?startY:bottom;
   extensions=`M${x} ${edge+(outer?-4:4)}V${y+(outer?-5:5)} M${x+length} ${edge+(outer?-4:4)}V${y+(outer?-5:5)}`;
  }else{
   let side:'left'|'right'='right',lane=0;
   if(d.id==='height'){side='left';lane=lanes.left.length;}
   else if(d.placement==='inside'){
    const key=d.id.replace(/^(glass|panel):/,''),chain=chainLanes.get(key)!;
    side=chain.side;lane=chain.lane;
    if(d.id.startsWith('glass:')){caption=`Polje ${d.id.split(':').slice(1).map(n=>Number(n)+1).join('.')}`;captionY=startY+10;}
   }else lane=lanes.right.length;
   x=(side==='left'?left-20:right+20)+(side==='left'?-1:1)*lane*58;
   labelX=x+(side==='left'?-8:8);labelY=y+length/2;anchor=side==='left'?'end':'start';
   if(d.id==='height'&&lanes.left.length){labelX=x+8;anchor='start';}
   else if(d.placement==='outside'&&d.id!=='height'&&lanes.right.length){labelX=x-8;anchor='end';}
   const edge=side==='left'?left:right;
   extensions=`M${edge+(side==='left'?-4:4)} ${y}H${x+(side==='left'?-5:5)} M${edge+(side==='left'?-4:4)} ${y+length}H${x+(side==='left'?-5:5)}`;
  }
  placements.push({dimension:d,x,y,length,labelX,labelY,anchor,extensions,caption,captionY,outer});
 }
 // Labels may share horizontal space between chains, but must never share the same row.
 const labelBox=(mark:DimensionPlacement)=>{
  const width=String(mark.dimension.value).length*(mark.outer?10:8)+8;
  return {left:mark.labelX-(mark.anchor==='end'?width:mark.anchor==='middle'?width/2:0),right:mark.labelX+(mark.anchor==='start'?width:mark.anchor==='middle'?width/2:0),top:mark.labelY-13,bottom:mark.labelY+13};
 };
 const stable=placements.filter(mark=>mark.dimension.placement==='inside');
 for(const mark of placements.filter(mark=>mark.dimension.axis==='height'&&mark.dimension.placement==='outside')){
  const original=mark.labelY;
  for(const offset of [0,-32,32,-64,64]){
   mark.labelY=Math.max(mark.y+10,Math.min(mark.y+mark.length-10,original+offset));
   const a=labelBox(mark);
   if(stable.every(other=>{const b=labelBox(other);return a.right+3<b.left||a.left-3>b.right||a.bottom+4<b.top||a.top-4>b.bottom;}))break;
  }
  stable.push(mark);
 }
 const bounds:DimensionBounds={left,right,top,bottom};
 for(const mark of placements){
  const width=String(mark.dimension.value).length*(mark.outer?10:8)+12;
  bounds.left=Math.min(bounds.left,mark.x-5,mark.labelX-(mark.anchor==='end'?width:mark.anchor==='middle'?width/2:0));
  bounds.right=Math.max(bounds.right,mark.x+(mark.dimension.axis==='width'?mark.length:5),mark.labelX+(mark.anchor==='start'?width:mark.anchor==='middle'?width/2:0));
  bounds.top=Math.min(bounds.top,mark.y,mark.labelY-14,mark.captionY===undefined?Infinity:mark.captionY-9);
  bounds.bottom=Math.max(bounds.bottom,mark.y+(mark.dimension.axis==='height'?mark.length:5),mark.labelY+12);
 }
 return {placements,bounds};
}
