import { bounds, distance, edgeLength, ends, isClosed, signedArea, type Geometry } from '../custom/geometry';
import { openingRegions } from '../custom/openings';
import { noPanels } from '../fixed-panels';
import { glassFractionOf, panelHeightOf, weightTotal, type Movement } from '../model-layout';
import { omittedDoorBottomLength } from '../door-bottom';
import { customInfillOf, type Opening, type Position } from '../models';
import { combinationParts } from '../combination';

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
 const door=customGeometry&&p.customKind?p.customKind==='door':p.category==='Vrata'||p.category==='Ulazna vrata'||p.category==='Sobna vrata'||p.category==='Klizni sistemi';
 const omittedBottom=omittedDoorBottomLength(p)/1000;
 const openings:{movement:Movement;door:boolean}[]=[];
 let sash=0;
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
   const regions=marks.length?new Map(openingRegions(customGeometry).map(region=>[region.id,region])):null;
   for(const mark of marks){
    const region=regions?.get(mark.region);
    if(!region)continue;
    sash+=region.perimeter;
    const movement=mark.side==='bottom'?'tilt':mark.tilt?(mark.side==='left'?'tiltLeft':'tiltRight'):mark.side;
    openings.push({movement,door});
   }
   const shaped=!isRectangle(customGeometry);
   let glass=panel?0:area;
   if(!panel&&shaped){
    const blank=bounds(customGeometry);
    glass=blank.width*blank.height/mm2ToM2;
   }
   return {area,perimeter,frame:perimeter-omittedBottom,sash:sash/1000,bend,divider,glass,panel:panel?area:0,louvres:0,shaped,openings};
  }catch{return null;}
 }

 if(modelLayout){
  const rowsHeight=weightTotal(modelLayout.rows);
  if(modelLayout.rows.some(row=>row.cells.some(cell=>cell.infill==='glassPanel'&&(panelHeightOf(cell,height*row.weight/rowsHeight)<=0||panelHeightOf(cell,height*row.weight/rowsHeight)>=height*row.weight/rowsHeight))))return null;
  let area=0,glass=0,panel=0,louvres=0,perimeter=0,divider=0;
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
     if(cell.infill==='glass'||cell.infill==='glassPanel')glass+=field*(cell.infill==='glassPanel'?glassFractionOf(cell,rowHeight):1);
     if(cell.infill==='panel'||cell.infill==='glassPanel')panel+=field*(cell.infill==='glassPanel'?1-glassFractionOf(cell,rowHeight):1);
     if(cell.infill==='slats')louvres+=field;
     if(cell.infill==='glassPanel')divider+=cellWidth;
     const cellPerimeter=2*(cellWidth+rowHeight);
     if(cell.movement!=='fixed'){
      sash+=cellPerimeter;
      openings.push({movement:cell.movement,door});
     }
     perimeter+=cellPerimeter;
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
  return area>0?{area,perimeter:perimeter/1000,frame:perimeter/1000-omittedBottom,sash:sash/1000,divider:divider/1000,bend:0,glass,panel,louvres,shaped:false,openings}:null;
 }

 const perimeter=2*(width+height)/1000;
 if(combination){
  const parts=combinationParts(p);
  if(p.segments.length<2||parts.windowLeaves<1||!Number.isFinite(combination.windowHeight)||combination.windowHeight<=0)return null;
  let area=0,frame=0,divider=0;
  for(const [leaves,partHeight,isDoor] of [[parts.door,height,true],[parts.window,combination.windowHeight,false]] as const){
   const partWidth=leaves.reduce((total,s)=>total+s.width,0);
   area+=partWidth*partHeight;
   frame+=2*(partWidth+partHeight);
   leaves.forEach((segment,index)=>{
    if(index>0&&(segment.opening==='Fiksno'||leaves[index-1].opening==='Fiksno'))divider+=partHeight;
    if(segment.opening==='Fiksno')return;
    sash+=2*(segment.width+partHeight);
    openings.push({movement:segmentMovements[segment.opening],door:isDoor});
   });
  }
  return {area:area/mm2ToM2,perimeter,frame:frame/1000-omittedBottom,sash:sash/1000,divider:divider/1000,bend:0,glass:area/mm2ToM2,panel:0,louvres:0,shaped:false,openings};
 }
 const area=width*height/mm2ToM2;
 const {top,bottom,left,right}=p.fixedPanels??noPanels;
 const centerHeight=Math.max(0,height-top-bottom);
 const vertical=Number(left>0)+Number(right>0);
 const horizontal=Number(top>0)+Number(bottom>0);
 let divider=horizontal*width+vertical*centerHeight;
 p.segments.forEach((segment,index)=>{
  if(index>0&&(segment.opening==='Fiksno'||p.segments[index-1].opening==='Fiksno'))divider+=centerHeight;
  if(segment.opening==='Fiksno')return;
  sash+=2*(segment.width+centerHeight);
  openings.push({movement:segmentMovements[segment.opening],door});
 });
 return {area,perimeter,frame:perimeter-omittedBottom,sash:sash/1000,divider:divider/1000,bend:0,glass:area,panel:0,louvres:0,shaped:false,openings};
}
