import { useId } from 'react';
import type { Position } from '../models';
import { Field } from './UI';
import { mainLeafLabels, type MainLeaf } from '../combination';

const choices:(MainLeaf|'both')[]=['left','right','both'];
const hint=(p:Position)=>p.mainLeaf==='left'?'Levo krilo je glavno.':p.mainLeaf==='right'?'Desno krilo je glavno.':'Glavno krilo nije izabrano: oba krila su glavna.';

/** Main (active) leaf of a two-leaf door. No choice means both leaves are main. */
export function MainLeafControl({position,onChange,select=true}:{position:Position;onChange:(patch:Partial<Position>)=>void;select?:boolean}){
 const heading=useId();
 const value=position.mainLeaf??'both';
 const change=(next:string)=>onChange({mainLeaf:next==='left'||next==='right'?next:undefined});
 if(select)return <Field label="Glavno krilo (vrata)"><select value={value} onChange={event=>change(event.target.value)}><option value="both">Nije izabrano (oba)</option><option value="left">Levo</option><option value="right">Desno</option></select></Field>;
 return <section className="visual-control door-bottom-control main-leaf-control" aria-labelledby={heading}>
  <h2 id={heading}>Glavno krilo</h2>
  <div role="group" aria-label="Glavno krilo">
   {choices.map(choice=><button type="button" key={choice} aria-pressed={value===choice} className={value===choice?'selected':''} onClick={()=>change(choice)}>{mainLeafLabels[choice]}</button>)}
  </div>
  <p>{hint(position)}</p>
 </section>;
}
