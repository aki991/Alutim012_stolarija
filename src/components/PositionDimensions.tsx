import type { Position } from '../models';
import type { PositionDimension } from '../position-dimensions';
import { layoutDimensions } from '../dimension-layout';
import { DrawingDimension } from './DrawingDimension';

export function PositionDimensions({position,origin,scale,onSelect}:{position:Position;origin:{x:number;y:number};scale:number;onSelect?:(dimension:PositionDimension)=>void}){
 return <g className="position-dimensions">{layoutDimensions(position,origin,scale).placements.map(({dimension:d,...placement})=><DrawingDimension key={d.id} id={d.id} label={d.label} value={d.value} axis={d.axis} {...placement} onSelect={onSelect?()=>onSelect(d):undefined}/>)}</g>;
}
