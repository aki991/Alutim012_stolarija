import type { DoorBottom } from '../models';
import { aluThresholdMm, doorBottomLabels } from '../door-bottom';
import type { DrawingBox } from './ShutterArtwork';

export function DoorBottomArtwork({mode,box,scale,compact,label=true,labelY}:{mode:DoorBottom;box:DrawingBox;scale:number;compact:boolean;label?:boolean;labelY?:number}){
 const height=aluThresholdMm*scale,bottom=box.y+box.height;
 return <g data-door-bottom={mode}>
  <title>{doorBottomLabels[mode]}</title>
  {mode==='alu24'&&<rect data-threshold-mm={aluThresholdMm} x={box.x} y={bottom-height} width={box.width} height={height} fill="#bbc8d0" stroke="#455964" strokeWidth=".9"/>}
  {!compact&&label&&<text x={box.x+box.width/2} y={labelY??bottom+21} textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="11" fill="#63737c">{doorBottomLabels[mode]}</text>}
 </g>;
}
