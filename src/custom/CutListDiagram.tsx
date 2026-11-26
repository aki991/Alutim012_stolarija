import { bounds, contourPath, pointAt, signedArea } from './geometry';
import { cornerLabel, type ElementCuttingList } from './cut-list';

export function CutListDiagram({list}:{list:ElementCuttingList}){
 const g=list.geometry,box=bounds(g),scale=Math.min(300/box.width,160/box.height);
 const offset={x:(400-box.width*scale)/2,y:(240-box.height*scale)/2};
 const project=(p:{x:number;y:number})=>({x:offset.x+(p.x-box.x)*scale,y:offset.y+(p.y-box.y)*scale});
 const winding=Math.sign(signedArea(g));
 return <svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240" role="img" aria-label="Oznake profila i krajeva za krojnu listu" fontFamily="Arial, sans-serif">
  <rect width="400" height="240" fill="#ffffff"/>
  <path d={contourPath(g)} transform={`translate(${offset.x-box.x*scale} ${offset.y-box.y*scale}) scale(${scale})`} fill="#e5f4fa" stroke="#354952" strokeWidth={2/scale}/>
  {g.edges.map((edge,index)=>{
   const point=project(pointAt(g,edge,.5)),a=pointAt(g,edge,.49),b=pointAt(g,edge,.51);
   const length=Math.hypot(b.x-a.x,b.y-a.y),x=point.x+winding*(b.y-a.y)/length*19,y=point.y-winding*(b.x-a.x)/length*19;
   return <g key={edge.id}><rect x={x-19} y={y-11} width="38" height="22" rx="5" fill="#126275"/><text x={x} y={y+5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">P{index+1}</text></g>;
  })}
  {g.edges.map((edge,index)=>{
   const p=project(g.points.find(vertex=>vertex.id===edge.from)!);
   return <g key={edge.from}><circle cx={p.x} cy={p.y} r="10" fill="#fff" stroke="#354952" strokeWidth="1.2"/><text x={p.x} y={p.y+4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#243039">{cornerLabel(index)}</text></g>;
  })}
 </svg>;
}
