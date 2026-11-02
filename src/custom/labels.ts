import { bounds, edgeArc, edgeLength, ends, fmt, pointAt, signedArea, type Geometry, type Point } from './geometry';
export type LabelBox={x:number;y:number;width:number;height:number};
export type DimensionLabel={id:string;text:string;center:Point;anchor:Point;angle:number;box:LabelBox;width:number;height:number;leader:boolean;locked:boolean};
export const boxesOverlap=(a:LabelBox,b:LabelBox,gap=0)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
/** Lay out in CSS-pixel units before converting back to model millimetres. */
export function dimensionLabels(g:Geometry,unit:number,viewport?:LabelBox):DimensionLabel[]{
 const b=bounds(g),view=viewport||{x:b.x-115*unit,y:b.y-115*unit,width:b.width+230*unit,height:b.height+230*unit};let orientation=1;try{orientation=Math.sign(signedArea(g))||1;}catch{/* Open sketches use the natural drawing direction. */}
 const placed:DimensionLabel[]=[],nodes=g.points.map(p=>({x:p.x-11*unit,y:p.y-11*unit,width:22*unit,height:22*unit}));
 for(const edge of g.edges)try{for(let i=0;i<=20;i++){const p=pointAt(g,edge,i/20),r=(edge.kind==='arc'&&i===10?21:3)*unit;nodes.push({x:p.x-r,y:p.y-r,width:2*r,height:2*r});}}catch{}
 for(const e of g.edges){try{
  const anchor=pointAt(g,e,.5),[a,z]=ends(g,e),tangent=e.kind==='line'?{x:z.x-a.x,y:z.y-a.y}:(()=>{const arc=edgeArc(g,e),angle=arc.start+arc.delta/2;return{x:-Math.sin(angle)*Math.sign(arc.delta),y:Math.cos(angle)*Math.sign(arc.delta)};})(),len=Math.hypot(tangent.x,tangent.y)||1,n={x:tangent.y/len*orientation,y:-tangent.x/len*orientation},text=e.kind==='arc'?`R ${fmt(edgeArc(g,e).radius)} mm`:`${fmt(edgeLength(g,e))} mm`,width=(text.length*7.8+16+(e.locked?20:0))*unit,height=32*unit,baseAngle=e.kind==='line'?((Math.atan2(tangent.y,tangent.x)*180/Math.PI+270)%180)-90:0;
  let best:DimensionLabel|undefined,bestCost=Infinity;
  const candidate=(center:Point,angle:number,leader:boolean)=>{const rad=angle*Math.PI/180,w=Math.abs(Math.cos(rad))*width+Math.abs(Math.sin(rad))*height,h=Math.abs(Math.sin(rad))*width+Math.abs(Math.cos(rad))*height,box={x:center.x-w/2,y:center.y-h/2,width:w,height:h},outside=Math.max(0,view.x+5*unit-box.x)+Math.max(0,view.y+5*unit-box.y)+Math.max(0,box.x+w-view.x-view.width+5*unit)+Math.max(0,box.y+h-view.y-view.height+5*unit),collisions=placed.filter(p=>boxesOverlap(box,p.box,5*unit)).length,nodeHits=nodes.filter(p=>boxesOverlap(box,p,2*unit)).length,cost=collisions*1e8+outside/unit*10000+nodeHits*100000+Math.hypot(center.x-anchor.x,center.y-anchor.y)/unit;
   if(cost<bestCost){bestCost=cost;best={id:e.id,text,center,anchor,angle,box,width,height,leader,locked:!!e.locked};}};
  for(const offset of [27,49,73,99])for(const shift of [0,26,-26,55,-55,90,-90])candidate({x:anchor.x+n.x*offset*unit+tangent.x/len*shift*unit,y:anchor.y+n.y*offset*unit+tangent.y/len*shift*unit},baseAngle,offset>27||shift!==0);
  if(bestCost>=100000){for(let y=view.y+height/2+8*unit;y+height/2<view.y+view.height-6*unit;y+=38*unit)for(let x=view.x+width/2+8*unit;x+width/2<view.x+view.width-6*unit;x+=32*unit)candidate({x,y},0,true);}
  if(best)placed.push(best);
 }catch{/* A malformed draft arc is reported by the geometry validator. */}}
 return placed;
}
