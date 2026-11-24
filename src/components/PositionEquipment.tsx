import { useId } from 'react';
import type { Position } from '../models';
import { changeShutter, makeShutter, shutterOf, supportsShutter } from '../shutters';
import { ShutterControls } from './ShutterControls';

export function PositionEquipment({position:p,onChange}:{position:Position;onChange:(patch:Partial<Position>)=>void}){
 const headingId=useId();
 const equipment=p.customGeometry?[]:([['mosquito','Komarnik'],['sill','Klupica']] as const);
 const allowShutter=supportsShutter(p),shutter=allowShutter?shutterOf(p):undefined;
 if(!allowShutter&&!equipment.length)return null;
 return <section className="visual-control equipment-control" aria-labelledby={headingId}>
  <h2 id={headingId}>Dodatna oprema</h2>
  <div className="field-checks">
   {allowShutter&&<label><input type="checkbox" checked={p.shutter} onChange={event=>onChange(changeShutter(p,event.target.checked?makeShutter():undefined))}/><span>Roletna</span></label>}
   {equipment.map(([key,label])=><label key={key}><input type="checkbox" checked={p[key]} onChange={e=>onChange({[key]:e.target.checked})}/><span>{label}</span></label>)}
  </div>
  {shutter&&<ShutterControls position={p} config={shutter} onChange={next=>onChange(changeShutter(p,next))}/>}
 </section>;
}
