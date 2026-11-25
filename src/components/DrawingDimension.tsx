import { fmt } from '../custom/geometry';

/** Plain technical labels with larger invisible targets for touch editing. */
export function DrawingDimension({id,label,value,axis,x,y,length,labelX,labelY,anchor,extensions,caption,captionY,onSelect,outer=false}:{id:string;label:string;value:number;axis:'width'|'height';x:number;y:number;length:number;labelX:number;labelY:number;anchor:'start'|'middle'|'end';extensions:string;caption?:string;captionY?:number;onSelect?:()=>void;outer?:boolean}){
 const font=outer?18:15,text=fmt(value),width=Math.max(30,text.length*font*.58+10),height=font+8;
 const offset=anchor==='end'?-width:anchor==='middle'?-width/2:0;
 const vertical=axis==='height';
 const ticks=vertical?`M${x-3} ${y+3}l6 -6 M${x-3} ${y+length+3}l6 -6`:`M${x-3} ${y+3}l6 -6 M${x+length-3} ${y+3}l6 -6`;
 return <g className={onSelect?'drawing-dimension interactive':'drawing-dimension'} data-position-dimension={id}>
  <path d={extensions} stroke="#c0c7cc" strokeWidth=".65" fill="none"/>
  <path d={(vertical?`M${x} ${y}v${length}`:`M${x} ${y}h${length}`)+ticks} stroke="#77858e" strokeWidth=".9" fill="none"/>
  {caption&&<text x={labelX} y={captionY} textAnchor={anchor} fontFamily="Arial,sans-serif" fontSize="9" fill="#7a858c">{caption}</text>}
  <g transform={`translate(${labelX} ${labelY})`} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={onSelect?`${label}: ${fmt(value)} mm`:undefined} onClick={e=>{e.stopPropagation();onSelect?.();}} onKeyDown={e=>{if(onSelect&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();onSelect();}}}>
   <title>{onSelect?`${label} — kliknite za izmenu`:`${label}: ${fmt(value)} mm`}</title>
   {onSelect&&<rect className="drawing-dimension-hit" x={offset-5} y="-20" width={Math.max(width+10,42)} height="40" fill="transparent"/>}
   <rect className="drawing-dimension-label" x={offset-3} y={-height/2} width={width+6} height={height} rx="4" fill="#fff" fillOpacity=".96" stroke="none"/>
   <text textAnchor={anchor} dominantBaseline="central" fontFamily="Arial,sans-serif" fontSize={font} fontWeight={outer?600:400} fill="#293840" pointerEvents="none">{text}</text>
  </g>
 </g>;
}
