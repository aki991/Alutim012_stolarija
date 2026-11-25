import { useId } from 'react';
import type { DoorBottom, Position } from '../models';
import { doorBottomLabels, supportsDoorBottom } from '../door-bottom';

export function DoorBottomControls({position,onChange}:{position:Position;onChange:(patch:Partial<Position>)=>void}){
 const heading=useId();
 if(!supportsDoorBottom(position))return null;
 return <section className="visual-control door-bottom-control" aria-labelledby={heading}>
  <h2 id={heading}>Donji deo vrata</h2>
  <div role="group" aria-label="Donji deo vrata">
   {(Object.keys(doorBottomLabels) as DoorBottom[]).map(value=><button type="button" key={value} aria-pressed={position.doorBottom===value} className={position.doorBottom===value?'selected':''} onClick={()=>onChange({doorBottom:value})}>{doorBottomLabels[value]}</button>)}
  </div>
  <p>{position.doorBottom==='alu24'?'Ukupna visina vrata uključuje ALU prag od 24 mm.':position.doorBottom==='frame'?'Ram sa sve četiri strane, uključujući donju stranu vrata.':'Izaberite ALU prag ili ram sa sve četiri strane.'}</p>
 </section>;
}
