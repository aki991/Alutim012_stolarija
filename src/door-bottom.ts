import type { DoorBottom, Position } from './models';
import { bounds, ends, isClosed } from './custom/geometry';
import { weightTotal } from './model-layout';

export const aluThresholdMm=24;
export const doorBottomLabels:Record<DoorBottom,string>={alu24:'ALU prag 24 mm',frame:'Ram u krug'};
const doorMovements=new Set(['left','right','tiltLeft','tiltRight','outLeft','outRight','pivotV','pivotVLeft','pivotVRight','doubleLeft','doubleRight']);

/** Bottom edges belonging to the door, in millimetres from the element's left edge. */
export function doorBottomSpans(p:Position):{x:number;width:number}[]{
 if(p.portaRoyal||!['Vrata','Ulazna vrata'].includes(p.category))return [];
 if(p.customGeometry){
  if(p.customKind!=='door'||!isClosed(p.customGeometry))return [];
  const g=p.customGeometry,b=bounds(g);
  return g.edges.flatMap(edge=>{
   const [a,c]=ends(g,edge);
   return edge.kind==='line'&&Math.abs(a.y-(b.y+b.height))<.01&&Math.abs(c.y-a.y)<.01
    ?[{x:Math.min(a.x,c.x)-b.x,width:Math.abs(c.x-a.x)}]:[];
  });
 }
 if(p.combination)return [{x:p.combination.windowSide==='left'?p.segments[1].width:0,width:p.segments[0].width}];
 if(p.modelLayout){
  const row=p.modelLayout.rows.at(-1)!;
  const total=weightTotal(row.cells);
  let x=0;
  return row.cells.flatMap(cell=>{
   const width=p.width*cell.weight/total,span={x,width};x+=width;
   return cell.infill!=='space'&&doorMovements.has(cell.movement)?[span]:[];
  });
 }
 const left=p.fixedPanels?.left??0,right=p.fixedPanels?.right??0;
 return [{x:left,width:Math.max(0,p.width-left-right)}];
}

export const supportsDoorBottom=(p:Position)=>doorBottomSpans(p).length>0;
export const doorBottomLabel=(p:Position)=>p.doorBottom&&supportsDoorBottom(p)?doorBottomLabels[p.doorBottom]:undefined;
