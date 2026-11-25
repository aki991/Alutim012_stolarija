import { fmt } from '../custom/geometry';
import type { Position } from '../models';
import { changeShutterDrive, changeShutterType, shutterBoxShapes, shutterGuides, shutterMaxBox, shutterMaxWidth, shutterMeasures, shutterMounts, shutterTypes, type ShutterConfig, type ShutterType } from '../shutters';
import { NumberInput } from './NumberInput';
import { Field } from './UI';

export function ShutterControls({position,config,onChange}:{position:Position;config:ShutterConfig;onChange:(config:ShutterConfig)=>void}) {
 const {part,width,totalHeight,frameHeight,openingHeight}=shutterMeasures(position,config);
 const standalone=position.category==='Roletne';
 const front=config.type==='reveal'||config.type==='facade';
 const strap=config.manualControl==='strap';
 const patch=(change:Partial<ShutterConfig>)=>onChange({...config,...change});
 return <div className="shutter-controls">
  <div className="field-options-grid">
   <Field label="Tip roletne"><select value={config.type} onChange={event=>onChange(changeShutterType(config,event.target.value as ShutterType))}>
    {Object.entries(shutterTypes).map(([key,type])=><option key={key} value={key}>{type.label}</option>)}
   </select></Field>
   <Field label="Visina kutije (mm)"><NumberInput inputMode="numeric" min={1} max={shutterMaxBox} value={config.boxHeight} onChange={event=>patch({boxHeight:Math.min(shutterMaxBox,Math.max(1,+event.target.value))})}/></Field>
   <Field label="Materijal kutije"><select value={config.boxMaterial??''} onChange={event=>patch({boxMaterial:(event.target.value||undefined) as ShutterConfig['boxMaterial']})}><option value="">Nije navedeno</option><option>PVC</option><option>ALU</option></select></Field>
   <Field label="Vodilica"><select value={config.guide??''} onChange={event=>patch({guide:(event.target.value||undefined) as ShutterConfig['guide']})}><option value="">Nije navedeno</option>{Object.entries(shutterGuides).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
   <Field label="Pogon roletne"><select value={config.motor===undefined?'':config.motor?'motor':strap?'strap':'manual'} onChange={event=>onChange(changeShutterDrive(config,event.target.value==='manual'?'cord':event.target.value==='strap'?'strap':event.target.value==='motor'?'motor':undefined))}><option value="">Nije navedeno</option><option value="manual">Bez motora (kanap)</option><option value="strap">Bez motora (traka)</option><option value="motor">Sa motorom</option></select></Field>
   {config.motor!==true&&<Field label={strap?'Strana trake':'Strana kanapa'}><select value={config.cordSide??''} onChange={event=>patch({cordSide:(event.target.value||undefined) as ShutterConfig['cordSide']})}><option value="">Nije navedeno</option><option value="left">Leva</option><option value="right">Desna</option></select></Field>}
   {config.motor===true&&<Field label="Strana motora"><select value={config.motorSide??''} onChange={event=>patch({motorSide:(event.target.value||undefined) as ShutterConfig['motorSide']})}><option value="">Nije navedeno</option><option value="left">Leva</option><option value="right">Desna</option></select></Field>}
   {config.motor===true&&<Field label="Daljinski upravljač"><select value={config.remote===undefined?'':config.remote?'with':'without'} onChange={event=>patch({remote:event.target.value===''?undefined:event.target.value==='with'})}><option value="">Nije navedeno</option><option value="with">Sa daljinskim</option><option value="without">Bez daljinskog</option></select></Field>}
   {position.combination&&<Field label="Roletna na delu"><select value={part} onChange={event=>patch({part:event.target.value as ShutterConfig['part']})}><option value="window">Prozor</option><option value="door">Vrata</option></select></Field>}
   {config.type==='flush'&&<Field label="Položaj kutije"><select value={config.mount} onChange={event=>patch({mount:event.target.value as ShutterConfig['mount'],width:undefined})}>
    {Object.entries(shutterMounts).map(([key,label])=><option key={key} value={key}>{label}</option>)}
   </select></Field>}
   {front&&<Field label="Oblik kutije"><select value={config.shape??'bevel'} onChange={event=>patch({shape:event.target.value as ShutterConfig['shape']})}>
    {config.shape==='halfRound'&&<option value="halfRound" disabled>Poluobla (izaberite rondo ili eko)</option>}
    {Object.entries(shutterBoxShapes).map(([key,label])=><option key={key} value={key}>{label}</option>)}
   </select></Field>}
   {!standalone&&config.mount==='above'&&<Field label="Širina roletne (mm)"><input type="number" inputMode="numeric" min={1} max={shutterMaxWidth} value={config.width??''} placeholder={String(Math.round(width))} onChange={event=>patch({width:event.target.value?Math.min(shutterMaxWidth,Math.max(1,+event.target.value)):undefined})}/></Field>}
  </div>
  <p className="shutter-control-note">Strana {config.motor===true?'motora':strap?'trake':'kanapa'} se određuje gledano iznutra.</p>
  <p className="shutter-measure-note">{standalone?`Ukupna visina roletne ${fmt(totalHeight)} mm uključuje kutiju.`:config.mount==='inside'?`Otvor ${fmt(openingHeight)} mm = ram ${fmt(frameHeight)} mm + kutija ${fmt(config.boxHeight)} mm.`:`${shutterMounts[config.mount]}. Ram ${fmt(frameHeight)} mm · roletna ${fmt(width)} × ${fmt(totalHeight)} mm.`}</p>
  {!position.shutterConfig&&<p className="shutter-measure-note">Ranije sačuvana roletna prikazana je sa predloženim merama. <button type="button" className="field-text-button" onClick={()=>onChange(config)}>Potvrdi tip i mere</button></p>}
 </div>;
}
