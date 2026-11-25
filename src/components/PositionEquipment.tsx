import { useId } from 'react';
import type { Position } from '../models';
import { changeShutter, makeShutter, shutterOf, supportsShutter } from '../shutters';
import { ShutterControls } from './ShutterControls';
import { accessories, accessoryDimensionPatch, accessorySize, resetAccessoryDimensions } from '../accessories';
import { Field } from './UI';
import { NumberInput } from './NumberInput';

export function PositionEquipment({position:p,onChange}:{position:Position;onChange:(patch:Partial<Position>)=>void}){
 const headingId=useId();
 const equipment=p.customGeometry?[]:accessories;
 const allowShutter=supportsShutter(p),shutter=allowShutter?shutterOf(p):undefined;
 if(!allowShutter&&!equipment.length)return null;
 return <section className="visual-control equipment-control" aria-labelledby={headingId}>
  <h2 id={headingId}>Dodatna oprema</h2>
  <div className="field-checks">
   {allowShutter&&<label><input type="checkbox" checked={p.shutter} onChange={event=>onChange(changeShutter(p,event.target.checked?makeShutter():undefined))}/><span>Roletna</span></label>}
   {equipment.map(({key,label})=><label key={key}><input type="checkbox" checked={Boolean(p[key])} onChange={e=>onChange({[key]:e.target.checked})}/><span>{label}</span></label>)}
  </div>
  {shutter&&<ShutterControls position={p} config={shutter} onChange={next=>onChange(changeShutter(p,next))}/>}
  {p.category==='Komarnici'&&<div className="field-checks"><label><input type="checkbox" checked={Boolean(p.mosquitoMotor)} onChange={e=>onChange({mosquitoMotor:e.target.checked})}/><span>Motor za komarnik</span></label></div>}
  {equipment.filter(({key})=>p[key]).map(({key,label,widthLabel,heightLabel})=>{
   const size=accessorySize(p,key);
   return <fieldset className="equipment-measures" key={key}><legend>{label}</legend><div className="field-options-grid">
    <Field label={widthLabel}><NumberInput clearToZero inputMode="numeric" min={1} max={20000} step={1} value={size.width} onChange={e=>onChange(accessoryDimensionPatch(p,key,'width',+e.target.value))}/></Field>
    <Field label={heightLabel}><NumberInput clearToZero inputMode="numeric" min={1} max={20000} step={1} value={size.height??''} placeholder={key==='mosquito'?undefined:'Nije navedeno'} onChange={e=>onChange(accessoryDimensionPatch(p,key,'height',key!=='mosquito'&&e.target.value===''?undefined:+e.target.value))}/></Field>
   </div>{key==='mosquito'&&p.category!=='Komarnici'&&<div className="field-checks"><label><input type="checkbox" checked={Boolean(p.mosquitoMotor)} onChange={e=>onChange({mosquitoMotor:e.target.checked})}/><span>Motor za komarnik</span></label></div>}<small>{key==='mosquito'?'Automatski: širina elementa − 50 mm, visina elementa − 10 mm.':'Dužina prati širinu elementa. Dubinu unesite po potrebi.'}</small><button type="button" className="field-text-button" onClick={()=>onChange(resetAccessoryDimensions(p,key))}>Vrati automatske mere</button></fieldset>;
  })}
 </section>;
}
