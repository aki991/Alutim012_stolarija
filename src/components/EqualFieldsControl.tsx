import { useId } from 'react';
import type { Position } from '../models';
import { equalizePosition, equalModeLabels, equalModesForPosition } from '../equal-fields';

/** Quick width presets for elements with more than two fields; the overall width never changes. */
export function EqualFieldsControl({position,onChange}:{position:Position;onChange:(patch:Partial<Position>)=>void}){
 const heading=useId();
 const modes=equalModesForPosition(position);
 if(!modes.length)return null;
 return <section className="visual-control choice-control equal-fields-control" aria-labelledby={heading}>
  <h2 id={heading}>Širine polja</h2>
  <div role="group" aria-label="Širine polja" style={{gridTemplateColumns:`repeat(${modes.length},minmax(0,1fr))`}}>
   {modes.map(mode=><button type="button" key={mode} onClick={()=>onChange(equalizePosition(position,mode))}>{equalModeLabels[mode]}</button>)}
  </div>
  <p>Ukupna širina ostaje ista. Kote na crtežu i dalje možete menjati pojedinačno.</p>
 </section>;
}
