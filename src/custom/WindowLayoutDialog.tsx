import { NumberInput } from '../components/NumberInput';
import { useState } from 'react';
import { Field, Modal } from '../components/UI';
import { bounds, type Geometry } from './geometry';
import { archTopOffset, divideWindow, type FixedPanels } from './windowLayout';

export function WindowLayoutDialog({geometry,onApply,onClose}: {
 geometry: Geometry; onApply:(next: Geometry)=>void; onClose:()=>void;
}) {
 const archOffset = archTopOffset(geometry);
 const {x,y,width,height} = bounds(geometry);
 const bars = new Map(geometry.bars.map(bar=>[bar.id,bar.a]));
 const [fixed,setFixed] = useState<FixedPanels>({
  top:(bars.get('layout-top')?.y ?? y+(bars.size?0:archOffset))-y,
  bottom:y+height-(bars.get('layout-bottom')?.y ?? y+height),
  left:(bars.get('layout-left')?.x ?? x)-x,
  right:x+width-(bars.get('layout-right')?.x ?? x+width),
 });
 const [leaves,setLeaves] = useState<1|2>(bars.has('layout-middle')?2:1);
 const [error,setError] = useState('');

 return <Modal title="Podeli prozor" onClose={onClose}>
  <form className="window-layout-form" onSubmit={event=>{
   event.preventDefault();
   try { onApply(divideWindow(geometry,fixed,leaves)); }
   catch (err) { setError((err as Error).message); }
  }}>
   <p>Unesi visinu gornjeg i donjeg polja i širinu bočnih polja. Nula izostavlja polje.</p>
   {archOffset>0&&<button type="button" className="field-button field-button-light" onClick={()=>setFixed({...fixed,top:archOffset})}>Odvoji gornji luk</button>}
   <div className="form-grid">
    {([['top','Fiksno gore'],['bottom','Fiksno dole'],['left','Fiksno levo'],['right','Fiksno desno']] as const).map(([key,label])=>
     <Field key={key} label={`${label} (mm)`}><NumberInput clearToZero inputMode="decimal" min={0} step="any" value={fixed[key]} onChange={event=>setFixed({...fixed,[key]:Number(event.target.value)})}/></Field>)}
   </div>
   <Field label="Polja u srednjem delu"><select value={leaves} onChange={event=>setLeaves(event.target.value==='2'?2:1)}>
    <option value="1">Jedno polje</option><option value="2">Dva polja</option>
   </select></Field>
   {!!(geometry.bars.length||geometry.openings?.length)&&<p>Primena zamenjuje postojeće prečke i oznake otvaranja. Otvaranje zatim označi na novim poljima.</p>}
   {error&&<p role="alert" className="field-error">{error}</p>}
   <button className="field-button field-button-yellow" type="submit">Primeni raspored</button>
  </form>
 </Modal>;
}
