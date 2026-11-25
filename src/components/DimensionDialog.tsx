import { useEffect, useRef, useState } from 'react';
import type { Position } from '../models';
import { changePositionDimension, type PositionDimension } from '../position-dimensions';
import { validatePosition } from '../services/calculation';
import { Drawing } from './Drawing';
import { Field, Modal } from './UI';

export function DimensionDialog({position,dimension,onApply,onClose}:{position:Position;dimension:PositionDimension;onApply:(position:Position)=>void;onClose:()=>void}){
 const [value,setValue]=useState(String(dimension.value)),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{input.current?.focus();input.current?.select();},[]);
 let next=position,error='';
 try{next=changePositionDimension(position,dimension.id,value.trim()?Number(value):NaN);error=validatePosition(next)[0]??'';}catch(e){error=(e as Error).message;}
 return <Modal title={`Izmeni kotu: ${dimension.label}`} onClose={onClose}>
  <form className="dimension-dialog" onSubmit={e=>{e.preventDefault();if(!error)onApply(next);}}>
   <Field label="Dimenzija (mm)"><input ref={input} type="number" aria-label="Dimenzija (mm)" inputMode="decimal" min={dimension.min} max={dimension.max} step="0.01" value={value} onChange={e=>setValue(e.target.value)}/></Field>
   <p>Pregled se menja dok unosite meru. Promena se čuva kada potvrdite.</p>
   <div className="dimension-dialog-preview" aria-label="Pregled nove mere"><Drawing position={error?position:next}/></div>
   {error&&<p className="field-error" role="alert">{error}</p>}
   <div className="modal-footer"><button type="button" className="field-button field-button-light" onClick={onClose}>Otkaži</button><button type="submit" className="field-button field-button-yellow" disabled={!!error}>Primeni meru</button></div>
  </form>
 </Modal>;
}
