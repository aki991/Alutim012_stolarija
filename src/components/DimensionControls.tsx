import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { NumberInput } from './NumberInput';

export type ElementDimensions = {width:number;height:number};

export function DimensionControls({size,min,max,heightLabel='Visina (mm)',clearToZero=false,onChange}:{
 size:ElementDimensions;min:ElementDimensions;max:ElementDimensions;heightLabel?:string;clearToZero?:boolean;
 onChange:(key:keyof ElementDimensions,value:number)=>void;
}) {
 const id=useId();
 const fields=[['width','Širina (mm)','širinu'],['height',heightLabel,'visinu']] as const;
 return <div className="dimension-controls">
  {fields.map(([key,label,axis])=>{
   const value=size[key];
   return <div className="dimension-control" key={key}>
    <label htmlFor={`${id}-${key}`}>{label}</label>
    <div>
     <button type="button" aria-label={`Smanji ${axis}`} disabled={value<=min[key]} onClick={()=>onChange(key,Math.max(min[key],value-10))}><Minus/></button>
     <NumberInput id={`${id}-${key}`} inputMode="numeric" min={min[key]} max={max[key]} step={1}
      value={clearToZero&&value===0?'':value} clearToZero={clearToZero} onChange={event=>onChange(key,Number(event.target.value))}/>
     <button type="button" aria-label={`Povećaj ${axis}`} onClick={()=>onChange(key,Math.min(max[key],value+10))}><Plus/></button>
    </div>
   </div>;
  })}
 </div>;
}
