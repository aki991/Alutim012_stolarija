import { distance, edgeLength, ends, isClosed, signedArea, type Geometry } from '../custom/geometry';
import { openingRegions } from '../custom/openings';
import { noPanels } from '../fixed-panels';
import { glassPanelFraction, weightTotal, type Movement } from '../model-layout';
import { customInfillOf, type Opening, type Position } from '../models';

const segmentMovements:Record<Opening,Movement>={Fiksno:'fixed',Levo:'left',Desno:'right',Kip:'tilt','Levo + kip':'tiltLeft','Desno + kip':'tiltRight',Klizno:'slideLeft'};
const mm2ToM2=1e6;

function isRectangle(g:Geometry){
 if(g.edges.length!==4||g.edges.some(edge=>edge.kind!=='line'))return false;
 const vectors=g.edges.map(edge=>{const [a,b]=ends(g,edge);return {x:b.x-a.x,y:b.y-a.y};});
 return vectors.every((a,index)=>{
  const b=vectors[(index+1)%vectors.length];
  return Math.abs(a.x*b.x+a.y*b.y)<=1e-8*Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y);
 });
}

export function positionMeasures(p:Position){
 const {width,height,modelLayout,customGeometry,combination}=p;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 if(customGeometry){
  if(!isClosed(customGeometry))return null;
  try{
   const area=Math.abs(signedArea(customGeometry))/mm2ToM2;
   if(!Number.isFinite(area)||area<=0)return null;
   let perimeter=0,bend=0;
   for(const edge of customGeometry.edges){
    const length=edgeLength(customGeometry,edge)/1000;
    perimeter+=length;
    if(edge.kind==='arc')bend+=length;
   }
   const divider=customGeometry.bars.reduce((total,bar)=>total+distance(bar.a,bar.b)/1000,0);
   const panel=customInfillOf(p)==='panel';
   const marks=customGeometry.openings??[];
   const regions=marks.length?new Set(openingRegions(customGeometry).map(region=>region.id)):new Set<string>();
   const moves:Movement[]=marks.filter(mark=>regions.has(mark.region)).map(mark=>mark.side==='bottom'?'tilt':mark.tilt?(mark.side==='left'?'tiltLeft':'tiltRight'):mark.side);
   return {area,perimeter,bend,divider,glass:panel?0:area,panel:panel?area:0,louvres:0,shaped:!isRectangle(customGeometry),moves};
  }catch{return null;}
 }

 if(modelLayout){
  const rowsHeight=weightTotal(modelLayout.rows);
  let area=0,glass=0,panel=0,louvres=0,perimeter=0,divider=0;
  const moves:Movement[]=[];
  let previous:{left:number;right:number}[]=[];
  for(const row of modelLayout.rows){
   const rowHeight=height*row.weight/rowsHeight;
   const rowWidth=weightTotal(row.cells);
   let left=0;
   const current:{left:number;right:number}[]=[];
   row.cells.forEach((cell,index)=>{
    const cellWidth=width*cell.weight/rowWidth;
    const right=left+cellWidth;
    if(cell.infill!=='space'){
     const field=cellWidth*rowHeight/mm2ToM2;
     area+=field;
     if(cell.infill==='glass'||cell.infill==='glassPanel')glass+=field*(cell.infill==='glassPanel'?glassPanelFraction:1);
     if(cell.infill==='panel'||cell.infill==='glassPanel')panel+=field*(cell.infill==='glassPanel'?1-glassPanelFraction:1);
     if(cell.infill==='slats')louvres+=field;
     if(cell.infill==='glassPanel')divider+=cellWidth;
     moves.push(cell.movement);
     perimeter+=2*(cellWidth+rowHeight);
     const neighbor=row.cells[index-1];
     if(neighbor&&neighbor.infill!=='space'){
      perimeter-=2*rowHeight;
      if((neighbor.movement==='fixed'||cell.movement==='fixed')&&modelLayout.cornerAfter!==index)divider+=rowHeight;
     }
     for(const above of previous){
      const shared=Math.max(0,Math.min(right,above.right)-Math.max(left,above.left));
      perimeter-=2*shared;
      divider+=shared;
     }
     current.push({left,right});
    }
    left=right;
   });
   previous=current;
  }
  return area>0?{area,perimeter:perimeter/1000,divider:divider/1000,bend:0,glass,panel,louvres,shaped:false,moves}:null;
 }

 const area=(combination?p.segments[0].width*height+p.segments[1].width*combination.windowHeight:width*height)/mm2ToM2;
 const {top,bottom,left,right}=p.fixedPanels??noPanels;
 const centerHeight=Math.max(0,height-top-bottom);
 const vertical=Number(left>0)+Number(right>0);
 const horizontal=Number(top>0)+Number(bottom>0);
 const divider=(horizontal*width+vertical*centerHeight)/1000;
 return {area,perimeter:2*(width+height)/1000,divider,bend:0,glass:area,panel:0,louvres:0,shaped:false,moves:p.segments.map(segment=>segmentMovements[segment.opening])};
}
