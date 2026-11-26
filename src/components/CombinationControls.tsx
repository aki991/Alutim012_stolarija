import { NumberInput } from './NumberInput';
import type { Opening, Position } from '../models';
import { Field } from './UI';
import { openingBoxHeight } from '../shutters';
import { combinationParts, resizePart, resizePartLeaf, setPartLeafCount, setPartOpening, type CombinationPart } from '../combination';
import { MainLeafControl } from './MainLeafControl';

export function CombinationControls({position,combination,onChange}:{
 position:Position; combination:NonNullable<Position['combination']>; onChange:(next:Partial<Position>)=>void;
}) {
 const parts=combinationParts(position);
 return <>
  <div className="dimension-controls combination-parts">
   {([['Vrata','door'],['Prozor','window']] as const).map(([label,part]:readonly [string,CombinationPart])=>{
    const isWindow=part==='window';
    const leaves=parts[part],width=isWindow?parts.windowWidth:parts.doorWidth;
    const name=label.toLowerCase();
    const boxHeight=openingBoxHeight(position,part);
    const openings=['Levo','Desno','Levo + kip','Desno + kip','Kip',...(isWindow?['Fiksno']:[])];
    return <section key={label} className="visual-control">
     <h2>{label}</h2>
     <Field label={`Broj krila (${name})`}><select value={leaves.length} onChange={event=>onChange(setPartLeafCount(position,part,Number(event.target.value)))}><option value={1}>{isWindow?'Jednokrilni':'Jednokrilna'}</option><option value={2}>{isWindow?'Dvokrilni':'Dvokrilna'}</option></select></Field>
     <Field label={`Širina (${name}, mm)`}><NumberInput inputMode="numeric" min={100*leaves.length} value={Math.round(width*100)/100} onChange={event=>onChange(resizePart(position,part,Number(event.target.value)))}/></Field>
     <Field label={`Visina${boxHeight?' otvora':''} (${name}, mm)`}><NumberInput inputMode="numeric" min={200+boxHeight} value={(isWindow?combination.windowHeight:position.height)+boxHeight} onChange={event=>{
      const height=Number(event.target.value)-boxHeight;
      onChange(isWindow?{combination:{...combination,windowHeight:height}}:{height});
     }}/></Field>
     {leaves.length>1&&leaves.map((leaf,index)=><Field key={`width-${index}`} label={`Krilo ${index+1} (${name}, mm)`}><NumberInput inputMode="numeric" min={100} max={width-100} value={Math.round(leaf.width*100)/100} onChange={event=>onChange(resizePartLeaf(position,part,index,Number(event.target.value)))}/></Field>)}
     {leaves.map((leaf,index)=><Field key={`opening-${index}`} label={leaves.length>1?`Otvaranje (${name}, krilo ${index+1})`:`Otvaranje (${name})`}><select value={leaf.opening} onChange={event=>onChange(setPartOpening(position,part,index,event.target.value as Opening))}>
      {openings.map(value=><option key={value}>{value}</option>)}
     </select></Field>)}
     {!isWindow&&leaves.length===2&&<MainLeafControl position={position} onChange={onChange}/>}
    </section>;
   })}
  </div>
  <section className="visual-control combination-layout">
   <Field label="Položaj prozora"><select value={combination.windowSide} onChange={event=>onChange({combination:{...combination,windowSide:event.target.value as 'left'|'right'}})}><option value="right">Desno od vrata</option><option value="left">Levo od vrata</option></select></Field>
   <Field label="Poravnanje"><select value={combination.alignment} onChange={event=>onChange({combination:{...combination,alignment:event.target.value as 'top'|'bottom'}})}><option value="bottom">Po donjoj ivici</option><option value="top">Po gornjoj ivici</option></select></Field>
  </section>
 </>;
}
