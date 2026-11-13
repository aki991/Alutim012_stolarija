import { useId } from 'react';
import { noPanels, panelLabels } from '../fixed-panels';
import { customInfillOf } from '../models';
import { CustomDrawing } from '../custom/CustomDrawing';
import { ModelArtwork } from './ModelArtwork';
import type { Position } from '../models';
import { openingBoxHeight, shutterOf, shutterPart } from '../shutters';
import { ShutterArtwork, shutterExtent, type DrawingBox } from './ShutterArtwork';
import { PortaDrawing } from './PortaDrawing';

/** Proportional field sketch. Geometry and opening marks are shared by UI and PDFs. */
export function Drawing({position:p,selected=-1,onSelect,zoom=1,compact=false}:{position:Position;selected?:number;onSelect?:(i:number)=>void;zoom?:number;compact?:boolean}) {
 const drawingId=useId();
 const shutter=shutterOf(p);
 if(p.portaRoyal)return <PortaDrawing position={p} config={p.portaRoyal} compact={compact}/>;
 if(p.customGeometry)return <CustomDrawing geometry={p.customGeometry} frameMm={p.customFrameMm??70} frameColor={p.color} infill={customInfillOf(p)} compact={compact} shutter={shutter}/>;
 const W=560,H=450;
 const combination=p.combination,standalone=p.category==='Roletne';
 const doorBoxHeight=openingBoxHeight(p);
 const openingHeight=p.height+doorBoxHeight;
 const doorFrame:DrawingBox={x:0,y:doorBoxHeight,width:p.width,height:p.height};
 let windowFrame:DrawingBox|undefined;
 if(combination){
  doorFrame.width=p.segments[0].width;
  const windowWidth=p.segments[1].width,windowBoxHeight=openingBoxHeight(p,'window');
  const windowOpeningHeight=combination.windowHeight+windowBoxHeight;
  if(combination.windowSide==='left')doorFrame.x=windowWidth;
  windowFrame={x:combination.windowSide==='right'?doorFrame.width:0,y:windowBoxHeight+(combination.alignment==='bottom'?openingHeight-windowOpeningHeight:0),width:windowWidth,height:combination.windowHeight};
 }
 const shutterFrame=shutter&&(shutterPart(p,shutter)==='window'?windowFrame:doorFrame);
 const shutterSize=shutter&&shutterFrame&&!standalone?shutterExtent(shutterFrame,shutter):undefined;
 const minX=Math.min(0,shutterSize?.x??0),minY=Math.min(0,shutterSize?.y??0);
 const fullWidth=Math.max(p.width,shutterSize?shutterSize.x+shutterSize.width:0)-minX;
 const fullHeight=Math.max(openingHeight,shutterSize?shutterSize.y+shutterSize.height:0)-minY;
 const hasShutterDimensions=!!shutter&&!compact;
 const scale=Math.min((hasShutterDimensions?370:400)/Math.max(fullWidth,200),320/Math.max(fullHeight,200))*zoom;
 const outerX=(W-fullWidth*scale)/2+(hasShutterDimensions?-7:12),outerY=(H-fullHeight*scale)/2+12;
 const x=outerX-minX*scale,openingY=outerY-minY*scale,y=openingY+doorBoxHeight*scale;
 const drawingFrame=(part:DrawingBox):DrawingBox=>({x:x+part.x*scale,y:openingY+part.y*scale,width:Math.max(1,part.width*scale),height:Math.max(1,part.height*scale)});
 const width=Math.max(1,p.width*scale),height=Math.max(1,p.height*scale);
 const specialized=['Roletne','Komarnici','Klupice','Usluge'].includes(p.category);
 const safeId=(p.id+drawingId).replace(/[^a-zA-Z0-9-]/g,'');
 const panels=p.fixedPanels??noPanels;
 const top=panels.top*scale,bottom=panels.bottom*scale,leftPanel=panels.left*scale,rightPanel=panels.right*scale;
 const middleHeight=Math.max(1,height-top-bottom);
 const fixedPanes=[
  {side:'top',x,y,w:width,h:top},
  {side:'bottom',x,y:y+height-bottom,w:width,h:bottom},
  {side:'left',x,y:y+top,w:leftPanel,h:middleHeight},
  {side:'right',x:x+width-rightPanel,y:y+top,w:rightPanel,h:middleHeight},
 ] as const;
 let offset=leftPanel;
 const view=compact?`${outerX-5} ${outerY-5} ${Math.max(1,fullWidth*scale)+10} ${Math.max(1,fullHeight*scale)+10}`:`0 0 ${W} ${H}`;
 const openingBottom=openingY+openingHeight*scale;
 return <svg viewBox={view} role="img" aria-label={`${p.name}, ${p.width} puta ${openingHeight} milimetara`} style={{width:'100%',height:'100%',maxHeight:compact?90:undefined}} xmlns="http://www.w3.org/2000/svg">
  <defs>
   <linearGradient id={`glass-${safeId}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d8f0fc"/><stop offset="100%" stopColor="#f2fbff"/></linearGradient>
   <marker id={`arrow-${safeId}`} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M7 4L1 1v6z" fill="#20262a"/></marker>
  </defs>
  {!compact&&<g stroke="#20262a" strokeWidth="1.8" fill="none">
   <path d={`M${x} ${outerY-35}H${x+width}`} markerStart={`url(#arrow-${safeId})`} markerEnd={`url(#arrow-${safeId})`}/>
   <path d={`M${outerX-36} ${openingY}V${openingBottom}`} markerStart={`url(#arrow-${safeId})`} markerEnd={`url(#arrow-${safeId})`}/>
  </g>}
  {!compact&&<g fontFamily="Arial,sans-serif" fill="#15191b" fontSize="24" fontWeight="700"><text x={x+width/2} y={outerY-47} textAnchor="middle">{p.width} mm</text><text x={outerX-50} y={(openingY+openingBottom)/2} textAnchor="middle" transform={`rotate(-90 ${outerX-50} ${(openingY+openingBottom)/2})`}>{openingHeight} mm</text></g>}
  {p.modelLayout&&<ModelArtwork layout={p.modelLayout} box={{x,y,width,height}} glass={`url(#glass-${safeId})`} compact={compact}/>}
  {!combination&&!p.modelLayout&&!standalone&&<rect x={x} y={y} width={width} height={height} fill="#f5f5f3" stroke="#1f2529" strokeWidth="2.4"/>}
  {fixedPanes.filter(pane=>pane.w>0&&pane.h>0).map(pane=>{
   const inset=Math.min(5,pane.w/5,pane.h/5);
   return <rect key={pane.side} data-fixed-panel={pane.side} aria-label={panelLabels[pane.side]} x={pane.x+inset} y={pane.y+inset} width={pane.w-2*inset} height={pane.h-2*inset} fill={`url(#glass-${safeId})`} stroke="#222a2e" strokeWidth="1.5"/>;
  })}
  {!p.modelLayout&&!standalone&&p.segments.map((segment,i)=>{
   const sw=Math.max(1,segment.width*scale);
   const combinedFrame=combination?drawingFrame(i===0?doorFrame:windowFrame!):undefined;
   const sx=combinedFrame?.x??x+offset;
   offset+=sw;
   const isWindow=!!combination&&i===1;
   const sh=combinedFrame?.height??middleHeight;
   const sy=combinedFrame?.y??y+top;
   const inset=Math.min(9,sw/5,sh/5),l=sx+inset,r=Math.max(l+1,sx+sw-inset),t=sy+inset,b=Math.max(t+1,sy+sh-inset),mid=(t+b)/2;
   const left=segment.opening.includes('Levo'),right=segment.opening.includes('Desno');
   return <g key={i} onClick={()=>onSelect?.(i)} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect?.(i);}}} aria-label={`Krilo ${i+1}, ${segment.opening}`} style={{cursor:onSelect?'pointer':undefined}}>
    {combination&&<rect data-combination-part={isWindow?'window':'door'} x={sx} y={sy} width={sw} height={sh} fill="#f5f5f3" stroke="#1f2529" strokeWidth="2.4"/>}
    <rect x={sx+3} y={sy+3} width={Math.max(1,sw-6)} height={Math.max(1,sh-6)} fill="#f5f5f3" stroke={selected===i?'#b00919':'#555e63'} strokeWidth={selected===i?3:1.2}/>
    <rect x={l} y={t} width={r-l} height={b-t} fill={`url(#glass-${safeId})`} stroke="#222a2e" strokeWidth="1.5"/>
    {!specialized&&<g stroke="#283a43" strokeWidth="1.7" strokeDasharray="7 5" fill="none">
     {left&&<path d={`M${l} ${t}L${r} ${mid}L${l} ${b}`}/>}
     {right&&<path d={`M${r} ${t}L${l} ${mid}L${r} ${b}`}/>}
     {(segment.opening.toLowerCase().includes('kip'))&&<path d={`M${l} ${b}L${(l+r)/2} ${t}L${r} ${b}`}/>}
     {segment.opening==='Klizno'&&<path d={`M${l+8} ${mid}H${r-8}m-12 -8l12 8-12 8`} strokeDasharray="none"/>}
    </g>}
    {p.category==='Komarnici'&&Array.from({length:12},(_,k)=><path key={k} d={`M${l} ${t+(b-t)*k/12}H${r}M${l+(r-l)*k/12} ${t}V${b}`} stroke="#8298a3" strokeWidth=".7"/>)}
   </g>;
  })}
  {shutter&&shutterFrame&&<ShutterArtwork frame={drawingFrame(shutterFrame)} config={shutter} scale={scale} standalone={standalone} dimensions={!compact}/>}
 </svg>;
}
