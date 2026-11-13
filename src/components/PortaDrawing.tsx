import type { Position } from '../models';
import { portaDirection, portaLeafCount, portaRoyalTypes, portaSliding, type PortaRoyalConfig } from '../porta-royal';

export function PortaDoorArt({config,x,y,width,height}:{config:PortaRoyalConfig;x:number;y:number;width:number;height:number}) {
 const {type,direction}=config;
 const overhead=type.startsWith('n')||type==='dn-03';
 const sliding=portaSliding(type),count=portaLeafCount(type),flipped=direction==='right';
 const header=overhead?height*.17:0;
 const trim=Math.min(7,width*.06,height*.04);
 const variant=type.split('-')[1];
 const ratios=count===3?[1/3,1/3,1/3]:count===1?[1]:type==='dk'?[.5,.5]:flipped?[.33,.67]:[.67,.33];
 let offset=x+trim;
 return <g data-porta-type={portaRoyalTypes[type]} stroke="#363d41" strokeWidth="1.35">
  <rect x={x} y={y} width={width} height={height} fill="#f1eeea"/>
  {sliding&&<rect x={x-trim} y={y} width={width+2*trim} height={trim*1.5} fill="#b6a898"/>}
  {overhead&&<rect x={x+trim} y={y+trim} width={width-2*trim} height={header-trim} fill="#dcecf3"/>}
  {ratios.map((ratio,index)=>{
   const w=ratio*(width-2*trim),l=offset,t=y+header+trim,h=height-header-2*trim;
   offset+=w;
   const active=type==='dk'||count===1||count===3&&index===1||count===2&&index===(flipped?1:0);
   const pull=l+w*(type==='dk'?(index===0?.84:.16):sliding?(flipped?.8:.2):flipped?.18:.82),mid=t+h*.52;
   const panes=variant==='02'?3:variant==='01'||variant==='03'?1:0;
   const paneHeight=panes>1?h*.18:h*.68;
   const paneWidth=variant==='01'?w*.19:w*.53;
   return <g key={index}>
    <rect x={l} y={t} width={w} height={h} fill="#ede3d8"/>
    {Array.from({length:panes},(_,j)=><rect key={j} x={l+(w-paneWidth)/2} y={t+h*.12+j*h*.24} width={paneWidth} height={paneHeight} fill="#dcecf3"/>)}
    {type==='4l'&&[.2,.4,.6,.8].map(row=><path key={row} d={`M${l+trim/2} ${t+h*row}h${w-trim}`} stroke="#8a7769"/>)}
    {active&&(sliding?<rect x={pull-2} y={mid-5} width="4" height="10" rx="2" fill="#72787c"/>:<path d={`M${pull} ${mid}h${flipped?7:-7}m${flipped?-7:7} 0v3`} strokeWidth="2"/>)}
   </g>;
  })}
  {sliding&&<path d={type==='dk'?`M${x+width*.24} ${y-7}h${width*.52}m-5 -4 5 4-5 4 M${x+width*.24+5} ${y-11}l-5 4 5 4`:`M${x+width*(flipped?.28:.72)} ${y-7}h${width*(flipped?.44:-.44)}m${flipped?-5:5} -4l${flipped?5:-5} 4 ${flipped?-5:5} 4`} fill="none"/>}
 </g>;
}

export function PortaDrawing({position,config,compact=false}:{position:Position;config:PortaRoyalConfig;compact?:boolean}) {
 const w=position.width>0?position.width:900,h=position.height>0?position.height:2100;
 const scale=Math.min(356/w,334/h),width=w*scale,height=h*scale,x=(560-width)/2,y=(450-height)/2+9;
 return <svg xmlns="http://www.w3.org/2000/svg" viewBox={compact?`${x-8} ${y-13} ${width+16} ${height+21}`:'0 0 560 450'} role="img" aria-label={`${position.name}, ${portaDirection(config)}`} style={{width:'100%',height:'100%'}}>
  <PortaDoorArt config={config} x={x} y={y} width={width} height={height}/>
  {!compact&&<g fontFamily="Arial,sans-serif" fontSize="18" textAnchor="middle" fill="#1c2529">
   <path d={`M${x} ${y-32}h${width}m${-width} -5v10m${width} -10v10 M${x-27} ${y}v${height}m-5 0h10m-10 ${-height}h10`} stroke="#313c41" fill="none"/>
   <text x={x+width/2} y={y-40}>{position.width>0?`${position.width} mm`:'—'}</text>
   <text transform={`translate(${x-38} ${y+height/2}) rotate(-90)`}>{position.height>0?`${position.height} mm`:'—'}</text>
   <text x="280" y="428">{portaRoyalTypes[config.type]} · {portaDirection(config)}</text>
  </g>}
 </svg>;
}
