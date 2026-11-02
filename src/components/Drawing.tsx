import { customInfillOf } from '../models';
import { CustomDrawing } from '../custom/CustomDrawing';
import type { Position } from '../models';

/** Proportional field sketch. Geometry and opening marks are shared by UI and PDFs. */
export function Drawing({position:p,selected=-1,onSelect,zoom=1,compact=false}:{position:Position;selected?:number;onSelect?:(i:number)=>void;zoom?:number;compact?:boolean}) {
 if(p.customGeometry)return <CustomDrawing geometry={p.customGeometry} frameMm={p.customFrameMm??70} frameColor={p.color} infill={customInfillOf(p)} compact={compact}/>;
 const W=560,H=450;
 const scale=Math.min(400/Math.max(p.width,200),320/Math.max(p.height,200))*zoom;
 const width=Math.max(1,p.width*scale),height=Math.max(1,p.height*scale);
 const x=(W-width)/2+12,y=(H-height)/2+12;
 const specialized=['Roletne','Komarnici','Klupice','Usluge'].includes(p.category);
 const safeId=p.id.replace(/[^a-zA-Z0-9-]/g,'');
 let offset=0;
 return <svg viewBox={compact?`${x-5} ${y-5} ${width+10} ${height+10}`:`0 0 ${W} ${H}`} role="img" aria-label={`${p.name}, ${p.width} puta ${p.height} milimetara`} style={{width:'100%',height:'100%',maxHeight:compact?90:undefined}} xmlns="http://www.w3.org/2000/svg">
  <defs>
   <linearGradient id={`glass-${safeId}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d8f0fc"/><stop offset="100%" stopColor="#f2fbff"/></linearGradient>
   <marker id={`arrow-${safeId}`} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M7 4L1 1v6z" fill="#20262a"/></marker>
  </defs>
  {!compact&&<g stroke="#20262a" strokeWidth="1.8" fill="none">
   <path d={`M${x} ${y-35}H${x+width}`} markerStart={`url(#arrow-${safeId})`} markerEnd={`url(#arrow-${safeId})`}/>
   <path d={`M${x-36} ${y}V${y+height}`} markerStart={`url(#arrow-${safeId})`} markerEnd={`url(#arrow-${safeId})`}/>
  </g>}
  {!compact&&<g fontFamily="Arial,sans-serif" fill="#15191b" fontSize="24" fontWeight="700"><text x={x+width/2} y={y-47} textAnchor="middle">{p.width} mm</text><text x={x-50} y={y+height/2} textAnchor="middle" transform={`rotate(-90 ${x-50} ${y+height/2})`}>{p.height} mm</text></g>}
  <rect x={x} y={y} width={width} height={height} fill="#f5f5f3" stroke="#1f2529" strokeWidth="2.4"/>
  {p.segments.map((segment,i)=>{
   const sw=Math.max(1,segment.width*scale),sx=x+offset;offset+=sw;
   const inset=Math.min(9,sw/5),l=sx+inset,r=Math.max(l+1,sx+sw-inset),t=y+9,b=Math.max(t+1,y+height-9),mid=(t+b)/2;
   const left=segment.opening.includes('Levo'),right=segment.opening.includes('Desno');
   return <g key={i} onClick={()=>onSelect?.(i)} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect?.(i);}}} aria-label={`Krilo ${i+1}, ${segment.opening}`} style={{cursor:onSelect?'pointer':undefined}}>
    <rect x={sx+3} y={y+3} width={Math.max(1,sw-6)} height={Math.max(1,height-6)} fill="#f5f5f3" stroke={selected===i?'#b00919':'#555e63'} strokeWidth={selected===i?3:1.2}/>
    <rect x={l} y={t} width={r-l} height={b-t} fill={`url(#glass-${safeId})`} stroke="#222a2e" strokeWidth="1.5"/>
    {!specialized&&<g stroke="#283a43" strokeWidth="1.7" strokeDasharray="7 5" fill="none">
     {left&&<path d={`M${l} ${t}L${r} ${mid}L${l} ${b}`}/>}
     {right&&<path d={`M${r} ${t}L${l} ${mid}L${r} ${b}`}/>}
     {(segment.opening.toLowerCase().includes('kip'))&&<path d={`M${l} ${b}L${(l+r)/2} ${t}L${r} ${b}`}/>}
     {segment.opening==='Klizno'&&<path d={`M${l+8} ${mid}H${r-8}m-12 -8l12 8-12 8`} strokeDasharray="none"/>}
    </g>}
    {p.category==='Roletne'&&Array.from({length:12},(_,k)=><line key={k} x1={l} x2={r} y1={t+(b-t)*k/12} y2={t+(b-t)*k/12} stroke="#53616a" strokeWidth="1.5"/>)}
    {p.category==='Komarnici'&&Array.from({length:12},(_,k)=><path key={k} d={`M${l} ${t+(b-t)*k/12}H${r}M${l+(r-l)*k/12} ${t}V${b}`} stroke="#8298a3" strokeWidth=".7"/>)}
   </g>;
  })}
 </svg>;
}
