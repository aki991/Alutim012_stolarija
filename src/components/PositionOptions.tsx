import { centralWidth } from '../fixed-panels';
import { customInfillOf } from '../models';
import { useState, type ReactNode } from 'react';
import { Camera, Check, ChevronRight, Droplet, Layers, MessageSquare, Minus, Plus, Puzzle, RectangleHorizontal, Settings, SlidersHorizontal, Wrench, X } from 'lucide-react';
import type { Position } from '../models';
import { useStore } from '../store';
import { Field, Modal } from './UI';

async function photoData(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Izaberite JPG, PNG ili WebP fotografiju.');
 if(file.size>10*1024*1024)throw Error('Fotografija može imati najviše 10 MB.');
 const bitmap=await createImageBitmap(file),scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=bitmap.width*scale;canvas.height=bitmap.height*scale;
 canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const data=canvas.toDataURL('image/jpeg',.65);if(data.length>650000)throw Error('Izaberite manju fotografiju.');return data;
}
function OptionsSection({title,icon,summary,children}:{title:string;icon:ReactNode;summary?:string;children:ReactNode}){
 return <details className="options-section"><summary>{icon}<span>{title}</span>{summary&&<small>{summary}</small>}<ChevronRight aria-hidden="true"/></summary><div className="options-section-content">{children}</div></details>;
}
export function PositionOptions({position:p,onChange,onClose}:{position:Position;onChange:(patch:Partial<Position>)=>void;onClose:()=>void}){
 const showPrices=useStore(s=>s.settings.showPrices!==false);
 const [error,setError]=useState(''),[preview,setPreview]=useState<string|null>(null),[loading,setLoading]=useState(false);
 const profiles=p.material==='PVC'?['PVC 70 mm','PVC 76 mm','PVC 82 mm']:['ALU termo profil','ALU hladni profil'];
 if(p.profile&&!profiles.includes(p.profile))profiles.unshift(p.profile);
 const colors=['Bela','Antracit','Orah'];if(!colors.includes(p.color))colors.push(p.color);
 const equipment=([['shutter','Roletna'],['mosquito','Komarnik'],['sill','Klupica']] as const);
 return <Modal title="Dodatne opcije" onClose={onClose} wide sheet><div className="position-options">
 <div className="position-options-body">
  <div className="options-basics-row">
   <Field label="Naziv elementa"><input maxLength={100} value={p.name} onChange={e=>onChange({name:e.target.value})}/></Field>
   <div className="options-quantity"><label htmlFor="option-quantity">Količina</label><div><button aria-label="Smanji količinu" disabled={p.quantity<=1} onClick={()=>onChange({quantity:Math.max(1,p.quantity-1)})}><Minus/></button><input id="option-quantity" type="number" inputMode="numeric" min={1} max={100} value={p.quantity} onChange={e=>onChange({quantity:+e.target.value})}/><button aria-label="Povećaj količinu" disabled={p.quantity>=100} onClick={()=>onChange({quantity:Math.min(100,p.quantity+1)})}><Plus/></button></div></div>
  </div>
  <div className="options-main-fields">
   <div className="option-setting"><Layers aria-hidden="true"/><Field label="Profil"><select value={p.profile||profiles[0]} onChange={e=>onChange({profile:e.target.value})}>{profiles.map(v=><option key={v}>{v}</option>)}</select></Field></div>
   <div className="option-setting option-color"><Droplet aria-hidden="true"/><div><span className="option-label" id="option-color-label">Boja</span><div className="option-color-buttons" role="group" aria-labelledby="option-color-label">{colors.map(color=><button key={color} className={p.color===color?'selected':''} aria-pressed={p.color===color} onClick={()=>onChange({color})}><i className={`color-swatch ${color==='Antracit'?'swatch-antracit':color==='Orah'?'swatch-orah':'swatch-bela'}`} aria-hidden="true"/>{color}{p.color===color&&<Check aria-hidden="true"/>}</button>)}</div></div></div>
   {(!p.customGeometry||customInfillOf(p)==='glass')&&<div className="option-setting"><RectangleHorizontal aria-hidden="true"/><Field label="Staklo"><select value={p.glass} onChange={e=>onChange({glass:e.target.value as Position['glass']})}>{['Dvoslojno','Troslojno','Sigurnosno'].map(v=><option key={v}>{v}</option>)}</select></Field></div>}
   {!p.customGeometry&&<div className="option-setting"><Settings aria-hidden="true"/><Field label="Okov"><select value={p.hardware} onChange={e=>onChange({hardware:e.target.value as Position['hardware']})}><option>Standardni</option><option>Sigurnosni</option></select></Field></div>}
  </div>
  <div className="options-sections">
   {!p.customGeometry&&<OptionsSection title="Dodatna oprema" icon={<Puzzle aria-hidden="true"/>} summary={equipment.filter(([key])=>p[key]).map(([,label])=>label).join(', ')}><div className="field-checks">{equipment.map(([key,label])=><label key={key}><input type="checkbox" checked={p[key]} onChange={e=>onChange({[key]:e.target.checked})}/><span>{label}</span></label>)}</div></OptionsSection>}
   {!p.customGeometry&&<OptionsSection title="Montaža" icon={<Wrench aria-hidden="true"/>} summary={[p.installation?'Uključena':'',p.removal?'Demontaža':''].filter(Boolean).join(', ')}><div className="field-checks">{([['installation','Montaža'],['removal','Demontaža']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={p[key]} onChange={e=>onChange({[key]:e.target.checked})}/><span>{label}</span></label>)}</div><div className="field-options-grid"><Field label="Pristup i uslovi montaže"><textarea rows={2} maxLength={1000} value={p.access} onChange={e=>onChange({access:e.target.value})}/></Field><Field label="Dodatni radovi"><input maxLength={200} value={p.extraWork} onChange={e=>onChange({extraWork:e.target.value})}/></Field>{showPrices&&<Field label="Dodatni radovi po komadu (€)"><input type="number" min={0} inputMode="decimal" value={p.extraCost} onChange={e=>onChange({extraCost:Math.max(0,+e.target.value)})}/></Field>}</div></OptionsSection>}
   <OptionsSection title="Napomena" icon={<MessageSquare aria-hidden="true"/>} summary={p.notes?'Uneta':''}><Field label="Napomena"><textarea rows={3} maxLength={2000} value={p.notes} onChange={e=>onChange({notes:e.target.value})}/></Field></OptionsSection>
   <OptionsSection title="Fotografije" icon={<Camera aria-hidden="true"/>} summary={`${p.photos.length}/4`}><div className="field-photos">{p.photos.map((photo,i)=><div key={i}><button onClick={()=>setPreview(photo)} aria-label={`Prikaži fotografiju ${i+1}`}><img src={photo} alt={`Fotografija objekta ${i+1}`}/></button><button className="field-photo-remove" onClick={()=>onChange({photos:p.photos.filter((_,k)=>k!==i)})} aria-label={`Ukloni fotografiju ${i+1}`}><X/></button>{photo.startsWith('/assets')&&<small>Ilustracija objekta</small>}</div>)}</div>
    <label className="field-button field-button-light upload-label"><Camera/>{loading?'Obrada fotografije…':'Dodaj fotografiju'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={p.photos.length>=4||loading} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setLoading(true);try{const photo=await photoData(file);onChange({photos:[...p.photos,photo]});setError('');}catch(err){setError((err as Error).message);}finally{setLoading(false);e.target.value='';}}}/></label>
    {error&&<p className="field-error" role="alert">{error}</p>}
   </OptionsSection>
   {!p.customGeometry&&p.segments.length>1&&<OptionsSection title="Raspored krila" icon={<SlidersHorizontal aria-hidden="true"/>}><div className="option-section-title"><h3>Širine pojedinačnih krila</h3><button className="field-text-button" onClick={()=>onChange({segments:p.segments.map(s=>({...s,width:centralWidth(p.width,p.fixedPanels)/p.segments.length}))})}>Izjednači</button></div><div className="field-options-grid">{p.segments.map((s,i)=><Field key={i} label={`Krilo ${i+1} (mm)`}><input type="number" inputMode="numeric" min={100} value={Math.round(s.width*100)/100} onChange={e=>onChange({segments:p.segments.map((seg,k)=>k===i?{...seg,width:+e.target.value}:seg)})}/></Field>)}</div></OptionsSection>}
  </div>
 </div>
 {preview&&<div className="field-photo-preview"><button className="field-button field-button-light" onClick={()=>setPreview(null)}>Zatvori fotografiju <X/></button><img src={preview} alt="Uvećana fotografija objekta"/></div>}
 <div className="options-footer"><button className="field-button field-button-yellow options-done" onClick={onClose}><Check/>Gotovo</button></div>
 </div></Modal>;
}
