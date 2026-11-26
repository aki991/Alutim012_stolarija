import type { DoorBottom, Position } from './models';
import { bounds, ends, isClosed, type Edge, type Geometry } from './custom/geometry';
import { weightTotal } from './model-layout';

export const aluThresholdMm=24;
export const doorBottomLabels:Record<DoorBottom,string>={alu24:'ALU prag 24 mm',frame:'Ram u krug',none:'Bez praga'};
export function isDoorBottomEdge(g:Geometry,edge:Edge){
 const [a,b]=ends(g,edge),box=bounds(g);
 return edge.kind==='line'&&Math.abs(a.y-(box.y+box.height))<.01&&Math.abs(b.y-a.y)<.01;
}

/** Bottom edges belonging to the door, in millimetres from the element's left edge. */
export function doorBottomSpans(p:Position):{x:number;width:number}[]{
 if(p.customGeometry){
  if(p.customKind!=='door'||!isClosed(p.customGeometry))return [];
  const g=p.customGeometry,b=bounds(g);
  return g.edges.flatMap(edge=>{
   const [a,c]=ends(g,edge);
   return isDoorBottomEdge(g,edge)
    ?[{x:Math.min(a.x,c.x)-b.x,width:Math.abs(c.x-a.x)}]:[];
  });
 }
 if(!['Vrata','Ulazna vrata','Sobna vrata','Klizni sistemi'].includes(p.category))return [];
 if(p.combination)return [{x:p.combination.windowSide==='left'?p.segments[1].width:0,width:p.segments[0].width}];
 if(p.modelLayout){
  const row=p.modelLayout.rows.at(-1)!;
  const total=weightTotal(row.cells);
  let x=0;
  return row.cells.flatMap(cell=>{
   const width=p.width*cell.weight/total,span={x,width};x+=width;
   return cell.infill!=='space'&&cell.movement!=='fixed'?[span]:[];
  });
 }
 const left=p.fixedPanels?.left??0,right=p.fixedPanels?.right??0;
 return [{x:left,width:Math.max(0,p.width-left-right)}];
}

export const supportsDoorBottom=(p:Position)=>doorBottomSpans(p).length>0;
export const doorBottomLabel=(p:Position)=>p.doorBottom&&supportsDoorBottom(p)?doorBottomLabels[p.doorBottom]:undefined;
export const omittedDoorBottomLength=(p:Position)=>p.doorBottom==='none'?doorBottomSpans(p).reduce((sum,span)=>sum+span.width,0):0;

/** Open the outer frame only under door leaves; preserve the bottom under adjacent fixed fields. */
export function openDoorFramePath(box:{x:number;y:number;width:number;height:number},openings:{x:number;width:number}[]){
 const {x,y,width,height}=box,right=x+width,bottom=y+height;
 let path=`M${x} ${bottom}V${y}H${right}V${bottom}`,cursor=x;
 for(const span of [...openings].sort((a,b)=>a.x-b.x)){
  const start=Math.max(x,Math.min(right,span.x)),end=Math.max(x,Math.min(right,span.x+span.width));
  if(start>cursor)path+=`M${cursor} ${bottom}H${start}`;
  cursor=Math.max(cursor,end);
 }
 if(cursor<right)path+=`M${cursor} ${bottom}H${right}`;
 return path;
}
