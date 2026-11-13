import { NumberInput } from './NumberInput';
import type { Opening, Position } from '../models';
import { Field } from './UI';
import { openingBoxHeight } from '../shutters';

export function CombinationControls({position,combination,onChange}:{
 position:Position; combination:NonNullable<Position['combination']>; onChange:(next:Partial<Position>)=>void;
}) {
 return <>
  <div className="dimension-controls combination-parts">
   {['Vrata','Prozor'].map((label,index)=>{
    const segment=position.segments[index];
    const isWindow=index===1;
    const boxHeight=openingBoxHeight(position,isWindow?'window':'door');
    return <section key={label} className="visual-control">
     <h2>{label}</h2>
     <Field label={`Širina (${label.toLowerCase()}, mm)`}><NumberInput inputMode="numeric" min={100} value={segment.width} onChange={event=>{
      const width=Number(event.target.value);
      onChange({width:width+position.segments[1-index].width,segments:position.segments.map((part,i)=>i===index?{...part,width}:part)});
     }}/></Field>
     <Field label={`Visina${boxHeight?' otvora':''} (${label.toLowerCase()}, mm)`}><NumberInput inputMode="numeric" min={200+boxHeight} value={(isWindow?combination.windowHeight:position.height)+boxHeight} onChange={event=>{
      const height=Number(event.target.value)-boxHeight;
      onChange(isWindow?{combination:{...combination,windowHeight:height}}:{height});
     }}/></Field>
     <Field label={`Otvaranje (${label.toLowerCase()})`}><select value={segment.opening} onChange={event=>onChange({segments:position.segments.map((part,i)=>i===index?{...part,opening:event.target.value as Opening}:part)})}>
      {['Levo','Desno','Levo + kip','Desno + kip','Kip',...(isWindow?['Fiksno']:[])].map(value=><option key={value}>{value}</option>)}
     </select></Field>
    </section>;
   })}
  </div>
  <section className="visual-control combination-layout">
   <Field label="Položaj prozora"><select value={combination.windowSide} onChange={event=>onChange({combination:{...combination,windowSide:event.target.value as 'left'|'right'}})}><option value="right">Desno od vrata</option><option value="left">Levo od vrata</option></select></Field>
   <Field label="Poravnanje"><select value={combination.alignment} onChange={event=>onChange({combination:{...combination,alignment:event.target.value as 'top'|'bottom'}})}><option value="bottom">Po donjoj ivici</option><option value="top">Po gornjoj ivici</option></select></Field>
  </section>
 </>;
}
