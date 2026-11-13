import { useId } from 'react';
import { ShutterArtwork, shutterBox, shutterExtent } from '../components/ShutterArtwork';
import type { ShutterConfig } from '../shutters';
import { bounds, contourPath, edgeArc, edgePath, ends, fmt, isClosed, pointAt, type Geometry } from './geometry';
import { angleLabels, dimensionLabels, type LabelBox } from './labels';
import { customOpeningLabel, openingRegions, type OpeningRegion } from './openings';

function OpeningMarks({g, regions, active, unit, frame}: {
 g: Geometry; regions: OpeningRegion[]; active?: string; unit: number; frame: number;
}) {
 const id = useId().replace(/[^a-zA-Z0-9]/g,'');
 return <g pointerEvents="none">{regions.map((region,index) => {
  const mark = g.openings?.find(value=>value.region===region.id);
  if (!mark && active !== region.id) return null;
  const xs = region.points.map(p=>p.x), ys = region.points.map(p=>p.y);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const width = right-left, height = bottom-top;
  const inset = Math.min(frame, width*.15, height*.15);
  const hinge = mark?.side==='left' ? left+inset : right-inset;
  const handle = mark?.side==='left' ? right-inset : left+inset;
  const sideMark=`M${hinge} ${top+inset}L${handle} ${top+height/2}L${hinge} ${bottom-inset}`;
  const tiltMark=`M${left+inset} ${bottom-inset}L${left+width/2} ${top+inset}L${right-inset} ${bottom-inset}`;
  const clip = `opening-${id}-${index}`;
  const points = region.points.map(p=>`${p.x},${p.y}`).join(' ');
  return <g key={region.id}>
   <defs><clipPath id={clip}><polygon points={points}/></clipPath></defs>
   {active===region.id&&<polygon points={points} fill="#008b66" fillOpacity=".14" stroke="#008b66" strokeWidth={2*unit}/>}
   {mark&&<path data-opening-side={mark.side} data-opening-tilt={mark.side==='bottom'||mark.tilt||undefined} d={mark.side==='bottom'?tiltMark:sideMark+(mark.tilt?tiltMark:'')} clipPath={`url(#${clip})`} fill="none" stroke="#253d50" strokeWidth={2*unit} strokeDasharray={`${7*unit} ${5*unit}`}><title>{customOpeningLabel(mark)}</title></path>}
  </g>;
 })}</g>;
}
export function GeometryArtwork({geometry:g,selected,unit=4,editable=false,dimensions=true,viewport,onDimensionSelect,frameMm=70,frameColor='Bela',infill='glass',regions,activeOpeningRegion,measureEnds,shutter}:{geometry:Geometry;regions?:OpeningRegion[];activeOpeningRegion?:string;selected?:string|null;unit?:number;editable?:boolean;dimensions?:boolean;viewport?:LabelBox;frameMm?:number;frameColor?:string;infill?:'glass'|'panel';onDimensionSelect?:(id:string)=>void;measureEnds?:{moving:string;fixed:string};shutter?:ShutterConfig}){
 const clipId='frame-'+useId().replace(/[^a-zA-Z0-9]/g,'');const frame=Math.max(20,Math.min(150,Number.isFinite(frameMm)?frameMm:70)),tone=frameColor==='Antracit'?'#42484d':frameColor==='Bela'?'#f1f2ee':'#9b7049';
 let path='';try{path=contourPath(g);}catch{path=g.edges.map(e=>{const[a,b]=ends(g,e);return `M${a.x} ${a.y}L${b.x} ${b.y}`;}).join(' ');}
 const shutterFrame=shutter&&isClosed(g)?bounds(g):undefined;
 const shutterBounds=shutter&&shutterFrame?shutterBox(shutterFrame,shutter):undefined;
 const labels=dimensions?dimensionLabels(g,unit,viewport,shutterBounds?[shutterBounds]:[]):[];
 const angles=dimensions?angleLabels(g,unit,labels,viewport):[];
 return <>
  {isClosed(g)?<g className="custom-profile-frame" pointerEvents="none"><defs><clipPath id={clipId}><path d={path}/></clipPath></defs><path d={path} fill={infill==='glass'?'#dcf2fc':frameColor==='Antracit'?'#596168':frameColor==='Bela'?'#e2e4df':'#b18a63'}/><g clipPath={`url(#${clipId})`}><path d={path} fill="none" stroke="#52595e" strokeWidth={2*frame} strokeLinejoin="miter"/><path d={path} fill="none" stroke={tone} strokeWidth={2*Math.max(1,frame-5)} strokeLinejoin="miter"/><path d={path} fill="none" stroke={frameColor==='Antracit'?'#687078':'#c5c9c9'} strokeWidth={Math.max(1,frame*.85)} strokeLinejoin="miter"/><path d={path} fill="none" stroke={tone} strokeWidth={Math.max(1,frame*.72)} strokeLinejoin="miter"/></g><path d={path} fill="none" stroke="#3e474d" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/></g>:<path d={path} fill="none" stroke="#42484d" strokeWidth="3" vectorEffect="non-scaling-stroke"/>}
  {g.edges.map(e=>{let d='';try{d=edgePath(g,e);}catch{return null;}return <g key={e.id}>
   {e.locked&&<path d={d} className="custom-locked-edge" stroke="#23658c" fill="none" strokeWidth="2.5" strokeDasharray="7 4" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
   {editable&&<path data-edge={e.id} d={d} fill="none" stroke="transparent" strokeWidth="30" vectorEffect="non-scaling-stroke" className="custom-edge-hit"/>}
   {selected===e.id&&<path d={d} stroke="#be0018" fill="none" strokeWidth="3" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
  </g>;})}
  {(regions||g.openings?.length)&&<OpeningMarks g={g} regions={regions??openingRegions(g)} active={activeOpeningRegion} unit={unit} frame={frame}/>}
  {shutter&&shutterFrame&&<ShutterArtwork frame={shutterFrame} config={shutter} unit={unit} dimensions={dimensions}/>}
  {g.bars.map(bar=>{
   const d=`M${bar.a.x} ${bar.a.y}L${bar.b.x} ${bar.b.y}`;
   return <g key={bar.id} clipPath={`url(#${clipId})`}>
    <path className="custom-bar-profile" d={d} stroke="#52595e" strokeWidth={frame} pointerEvents="none"/>
    <path d={d} stroke={tone} strokeWidth={Math.max(1,frame-5)} pointerEvents="none"/>
    {selected===bar.id&&<path d={d} stroke="#be0018" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
    {editable&&<path data-bar={bar.id} d={d} stroke="transparent" strokeWidth={Math.max(28,frame/unit)} vectorEffect="non-scaling-stroke"/>}
   </g>;
  })}
  {labels.map(label=><g key={label.id+'label'}>
   {label.leader&&<path d={`M${label.anchor.x} ${label.anchor.y}L${label.center.x} ${label.center.y}`} fill="none" stroke="#8d9aa8" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
   <g transform={`translate(${label.center.x} ${label.center.y}) rotate(${label.angle})`} data-dimension={editable?label.id:undefined} className={editable?'custom-dimension-label':undefined} role={editable?'button':undefined} tabIndex={editable?0:undefined} aria-label={editable?`${label.text}${label.locked?', zaključano':''}`:undefined} onKeyDown={e=>{if(editable&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onDimensionSelect?.(label.id);}}}>
    <rect x={-label.width/2} y={-label.height/2} width={label.width} height={label.height} rx={5*unit} fill={label.locked?'#edf7ff':'#ffffff'} fillOpacity=".95" stroke={selected===label.id?'#c0001a':'none'} strokeWidth="1" vectorEffect="non-scaling-stroke"/>
    <text data-dimension-text={label.id} x={label.locked?-8*unit:0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={15*unit} fontFamily="Arial,sans-serif" fontWeight="700" fill={label.locked?'#205775':'#191d21'} pointerEvents="none">{label.text}</text>
    {label.locked&&<g transform={`translate(${label.width/2-21*unit} ${-8*unit}) scale(${unit})`} fill="none" stroke="#23658c" strokeWidth="1.7" pointerEvents="none"><rect x="1" y="7" width="12" height="10" rx="2"/><path d="M4 7V4a3 3 0 016 0v3"/></g>}
   </g>
  </g>)}
  {angles.map(({id,text,arc,anchor,box,leader})=>{
   const x=box.x+box.width/2,y=box.y+box.height/2;
   return <g key={`angle-${id}`} data-contour-angle={id} pointerEvents="none">
    <title>{`Unutrašnji ugao ${text}`}</title>
    <path d={arc} fill="none" stroke="#226075" strokeWidth="1.4" vectorEffect="non-scaling-stroke"/>
    {leader&&<path d={`M${anchor.x} ${anchor.y}L${x} ${y}`} stroke="#226075" fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke"/>}
    <rect {...box} rx={4*unit} fill="#f5fcff" fillOpacity=".96"/>
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily="Arial,sans-serif" fontSize={15*unit} fontWeight="700" fill="#174e62">{text}</text>
   </g>;
  })}
  {editable&&g.points.map(p=>{
   const moving=measureEnds?.moving===p.id, fixed=measureEnds?.fixed===p.id;
   return <g key={p.id}>
    <circle data-node={p.id} cx={p.x} cy={p.y} r={20*unit} fill="transparent"/>
    <circle data-measure-end={moving?'moving':fixed?'fixed':undefined} cx={p.x} cy={p.y} r={(moving||fixed?11:7)*unit} fill={moving?'#be0018':fixed?'#23658c':'#fff'} stroke={moving||fixed?'#fff':'#24282c'} strokeWidth="2.5" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
    {(moving||fixed)&&<text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={13*unit} fontWeight="700" pointerEvents="none">{g.edges.find(edge=>edge.id===selected)?.from===p.id?'1':'2'}</text>}
   </g>;
  })}
  {editable&&g.edges.filter(e=>e.kind==='arc'&&!e.locked).map(e=>{try{const control=pointAt(g,e,.5),[a,b]=ends(g,e),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};return <g key={e.id+'control'}>{selected===e.id&&<path d={`M${mid.x} ${mid.y}L${control.x} ${control.y}`} stroke="#b08a32" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}<circle data-control={e.id} cx={control.x} cy={control.y} r={20*unit} fill="transparent" role="button" aria-label="Kontrolna tačka luka"><title>Povucite ka tetivi ili od nje da promenite radijus.</title></circle><circle cx={control.x} cy={control.y} r={7*unit} fill="#ffd46b" stroke="#9e6500" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/></g>;}catch{return null;}})}
 </>;
}
export function CustomDrawing({geometry,compact=false,frameMm=70,frameColor='Bela',infill='glass',shutter}:{geometry:Geometry;compact?:boolean;frameMm?:number;frameColor?:string;infill?:'glass'|'panel';shutter?:ShutterConfig}){
 const b=bounds(geometry),extent=shutterExtent(b,shutter);
 const unit=Math.max(extent.width,extent.height,200)/400,margin=compact?8*unit:120*unit;
 const inside=shutter?.mount==='inside',openingHeight=b.height+(inside?shutter.boxHeight:0);
 return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${extent.x-margin} ${extent.y-margin} ${Math.max(1,extent.width)+2*margin} ${Math.max(1,extent.height)+2*margin}`} role="img" aria-label={`Nacrtan element, ${fmt(b.width)} puta ${fmt(openingHeight)} milimetara`} className="custom-sketch">
  <GeometryArtwork geometry={geometry} frameMm={frameMm} frameColor={frameColor} infill={infill} unit={unit} dimensions={!compact} shutter={shutter}/>
  {!compact&&<text x={b.x+b.width/2} y={b.y+b.height+95*unit} textAnchor="middle" fontSize={14*unit} fontFamily="Arial,sans-serif" fill="#424b56">Širina {fmt(b.width)} mm · {inside?'Visina otvora':'Visina'} {fmt(openingHeight)} mm</text>}
 </svg>;
}
