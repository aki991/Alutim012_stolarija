import { fmt } from '../custom/geometry';
import type { Position } from '../models';
import { makeShutter, shutterBoxShapes, shutterMaxBox, shutterMaxWidth, shutterMeasures, shutterMounts, shutterTypes, type ShutterConfig, type ShutterType } from '../shutters';
import { NumberInput } from './NumberInput';
import { Field } from './UI';

export function ShutterControls({position,config,onChange}:{position:Position;config:ShutterConfig;onChange:(config:ShutterConfig)=>void}) {
 const {part,width,totalHeight,frameHeight,openingHeight}=shutterMeasures(position,config);
 const standalone=position.category==='Roletne';
 const front=config.type==='reveal'||config.type==='facade';
 const patch=(change:Partial<ShutterConfig>)=>onChange({...config,...change});
 return <div className="shutter-controls">
  <div className="field-options-grid">
   <Field label="Tip roletne"><select value={config.type} onChange={event=>onChange(makeShutter(event.target.value as ShutterType,config.part))}>
    {Object.entries(shutterTypes).map(([key,type])=><option key={key} value={key}>{type.label}</option>)}
   </select></Field>
   <Field label="Visina kutije (mm)"><NumberInput inputMode="numeric" min={1} max={shutterMaxBox} value={config.boxHeight} onChange={event=>patch({boxHeight:Math.min(shutterMaxBox,Math.max(1,+event.target.value))})}/></Field>
   {position.combination&&<Field label="Roletna na delu"><select value={part} onChange={event=>patch({part:event.target.value as ShutterConfig['part']})}><option value="window">Prozor</option><option value="door">Vrata</option></select></Field>}
   {config.type==='flush'&&<Field label="Položaj kutije"><select value={config.mount} onChange={event=>patch({mount:event.target.value as ShutterConfig['mount'],width:undefined})}>
    {Object.entries(shutterMounts).map(([key,label])=><option key={key} value={key}>{label}</option>)}
   </select></Field>}
   {front&&<Field label="Oblik kutije"><select value={config.shape??'bevel'} onChange={event=>patch({shape:event.target.value as ShutterConfig['shape']})}>
    {Object.entries(shutterBoxShapes).map(([key,label])=><option key={key} value={key}>{label}</option>)}
   </select></Field>}
   {!standalone&&config.mount==='above'&&<Field label="Širina roletne (mm)"><input type="number" inputMode="numeric" min={1} max={shutterMaxWidth} value={config.width??''} placeholder={String(Math.round(width))} onChange={event=>patch({width:event.target.value?Math.min(shutterMaxWidth,Math.max(1,+event.target.value)):undefined})}/></Field>}
  </div>
  <p className="shutter-measure-note">{standalone?`Ukupna visina roletne ${fmt(totalHeight)} mm uključuje kutiju.`:config.mount==='inside'?`Otvor ${fmt(openingHeight)} mm = ram ${fmt(frameHeight)} mm + kutija ${fmt(config.boxHeight)} mm.`:`${shutterMounts[config.mount]}. Ram ${fmt(frameHeight)} mm · roletna ${fmt(width)} × ${fmt(totalHeight)} mm.`}</p>
  {!position.shutterConfig&&<p className="shutter-measure-note">Ranije sačuvana roletna prikazana je sa predloženim merama. <button type="button" className="field-text-button" onClick={()=>onChange(config)}>Potvrdi tip i mere</button></p>}
 </div>;
}
