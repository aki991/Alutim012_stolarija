import { fmt } from '../custom/geometry';
import { shutterMounts, shutterTypes, type ShutterConfig } from '../shutters';

export type DrawingBox={x:number;y:number;width:number;height:number};

export function shutterBox(frame:DrawingBox,config:ShutterConfig,scale=1,standalone=false):DrawingBox {
 const width=standalone?frame.width:config.width===undefined?frame.width:config.width*scale;
 const height=config.boxHeight*scale;
 return {x:frame.x+(frame.width-width)/2,y:standalone||config.mount==='overlay'?frame.y:frame.y-height,width,height};
}

export function shutterExtent(frame:DrawingBox,config?:ShutterConfig):DrawingBox {
 if(!config)return frame;
 const box=shutterBox(frame,config);
 const x=Math.min(frame.x,box.x),y=Math.min(frame.y,box.y);
 return {x,y,width:Math.max(frame.x+frame.width,box.x+box.width)-x,height:Math.max(frame.y+frame.height,box.y+box.height)-y};
}

export function ShutterArtwork({frame,config,scale=1,unit=1,standalone=false,dimensions=false}:{frame:DrawingBox;config:ShutterConfig;scale?:number;unit?:number;standalone?:boolean;dimensions?:boolean}) {
 const box=shutterBox(frame,config,scale,standalone);
 const hiddenBox=config.type==='flush'||config.type==='lintel';
 const bottom=box.y+box.height,guideBottom=frame.y+frame.height;
 const guide=Math.min(5*unit,box.width/12);
 const slatCount=standalone?12:2;
 const curtainHeight=Math.max(0,standalone?guideBottom-bottom:Math.min(guideBottom-bottom,15*unit));
 const dimensionX=Math.max(box.x+box.width,frame.x+frame.width)+12*unit;
 const dimension=(top:number,end:number,height:number,key:string)=><g data-shutter-dimension={key}>
  <path d={`M${dimensionX-4*unit} ${top}h${8*unit} M${dimensionX} ${top}V${end} M${dimensionX-4*unit} ${end}h${8*unit}`} fill="none" stroke="#284955" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>
  <text x={dimensionX+6*unit} y={(top+end)/2} dominantBaseline="central" fontSize={17*unit} fontWeight="700" fontFamily="Arial,sans-serif" fill="#223a46">{fmt(height)} mm</text>
 </g>;
 return <g pointerEvents="none" aria-label={`Roletna · ${shutterTypes[config.type].label} · ${shutterMounts[config.mount]}`}>
  {guideBottom>bottom&&<g fill="#d5dde2" stroke="#586972" strokeWidth=".9" vectorEffect="non-scaling-stroke">
   <rect x={box.x} y={bottom} width={guide} height={guideBottom-bottom}/>
   <rect x={box.x+box.width-guide} y={bottom} width={guide} height={guideBottom-bottom}/>
  </g>}
  {curtainHeight>0&&<g fill="#e4e9ec" stroke="#6f818c" strokeWidth=".8" vectorEffect="non-scaling-stroke">
   <rect x={box.x+guide} y={bottom} width={box.width-2*guide} height={curtainHeight}/>
   {Array.from({length:slatCount},(_,i)=><path key={i} d={`M${box.x+guide} ${bottom+curtainHeight*(i+1)/(slatCount+1)}h${box.width-2*guide}`}/>)}
  </g>}
  <rect {...box} data-shutter-box={config.type} data-shutter-mount={config.mount} fill={hiddenBox?'#eef2f4':'#cbd5dc'} stroke="#405662" strokeWidth="1.35" strokeDasharray={hiddenBox?`${5*unit} ${3*unit}`:undefined} vectorEffect="non-scaling-stroke"/>
  <path d={`M${box.x+guide} ${box.y+box.height*.72}h${box.width-2*guide}`} stroke="#647b88" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke"/>
  {dimensions&&dimension(box.y,bottom,config.boxHeight,'box')}
  {dimensions&&!standalone&&config.mount==='inside'&&dimension(frame.y,guideBottom,frame.height/scale,'frame')}
 </g>;
}
