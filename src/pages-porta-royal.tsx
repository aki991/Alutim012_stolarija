import { useState, type ReactNode } from 'react';
import { Check, DoorOpen, Search } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { catalog, makePosition } from './catalog';
import { DimensionControls, type ElementDimensions } from './components/DimensionControls';
import { FieldHeader } from './components/FieldHeader';
import { ModuleHeader } from './components/ModuleHeader';
import { NewJobDialog } from './components/NewJobDialog';
import { NumberInput } from './components/NumberInput';
import { PortaPhoto, PortaTechnicalDetails, PortaVariantOptions } from './components/PortaOptions';
import { Empty, Field } from './components/UI';
import { isActiveJob, type Opening, type Position } from './models';
import { MissingJob } from './pages-editor';
import { catalogChoicePath } from './pages-lists';
import { isPortaDimension, portaCatalogPath, portaConfiguration, portaDefaultSelection, portaFills, portaGlazing, portaHandles, portaHinges, portaLocks, portaMaxDimension, portaOptions, portaPositionName, portaRoyalCatalog, portaRoyalGroups, portaRoyalSeries, portaRoyalTypes, portaSeriesById, portaSliding, portaStartingSize, portaTechnical, portaVariant, portaVariantCount, type PortaRoyalConfig, type PortaSelection } from './porta-royal';
import { positionCost, positionPriceLabel, validatePosition } from './services/calculation';
import { parseBackup } from './services/storage';
import { useNavigation } from './navigation';
import { jobFromSettings, useStore, workspaceDraftKey } from './store';
import './porta-royal.css';

const searchText=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const dimensionParams={width:'sirina',height:'visina'} as const;
const dimensionKeys=['width','height'] as const;

function readDimensions(params:URLSearchParams,type:PortaSelection['type']):ElementDimensions {
 const size=portaStartingSize(type);
 for(const key of dimensionKeys){
  const value=params.get(dimensionParams[key]);
  if(value!==null&&Number.isFinite(Number(value)))size[key]=Number(value);
 }
 return size;
}

function readSelection(params:URLSearchParams):PortaSelection|undefined {
 const series=portaSeriesById(params.get('serija')??'');
 if(!series)return undefined;
 const selected={series:series.id,decor:params.get('dekor')??'',type:params.get('tip') as PortaSelection['type']};
 return portaVariant(selected)?selected:portaDefaultSelection(series);
}

export function PortaCatalog() {
 const {id}=useParams(),jobs=useStore(s=>s.jobs),activeId=useNavigation(s=>s.jobId);
 const active=jobs.find(job=>id?job.id===id:job.id===activeId&&isActiveJob(job));
 const [params,setParams]=useSearchParams(),navigate=useNavigate(),location=useLocation();
 const selected=readSelection(params),search=params.get('q')??'',group=params.get('kolekcija')??'';
 const collectionParams=new URLSearchParams(params);
 for(const key of ['serija','dekor','tip',...Object.values(dimensionParams)])collectionParams.delete(key);
 const catalogReturn=collectionParams.size?`${location.pathname}?${collectionParams}`:location.pathname;
 const seriesList=portaRoyalSeries.filter(series=>{
  if(group&&series.group!==group)return false;
  const terms=searchText(`${series.name} ${portaRoyalGroups[series.group]} ${series.decors.map(decor=>decor.name).join(' ')} ${series.types.map(type=>portaRoyalTypes[type]).join(' ')}`);
  return searchText(search).trim().split(/\s+/).every(word=>terms.includes(word));
 });
 function openSelection(selection:PortaSelection){
  if(active){
   navigate(catalogChoicePath(active.id,{type:'sobna-vrata',porta:selection}),{state:{catalogReturn}});
   return;
  }
  const next=new URLSearchParams(collectionParams);
  next.set('serija',selection.series);next.set('dekor',selection.decor);next.set('tip',selection.type);
  setParams(next);
 }
 function filter(key:string,value:string){
  if(value)collectionParams.set(key,value);else collectionParams.delete(key);
  setParams(collectionParams,{replace:true});
 }
 if(id&&!active)return <MissingJob/>;
 if(selected){
  if(active){
   const size=readDimensions(params,selected.type);
   const hasSize=Object.values(dimensionParams).some(key=>params.has(key))&&Object.values(size).every(isPortaDimension);
   const path=catalogChoicePath(active.id,{type:'sobna-vrata',porta:{...selected,size:hasSize?size:undefined}});
   return <Navigate to={path} state={{catalogReturn}} replace/>;
  }
  return <PortaEditor key={location.search} catalogReturn={catalogReturn}/>;
 }
 const back=id?`/posao/${id}/dodaj`:'/katalog';
 return <div className="module-page porta-page">
  <ModuleHeader title="Sobna vrata" subtitle={active?`Porta Royal · ${active.customer.name}`:'Porta Royal'} icon={DoorOpen} back={back}>
   <a className="field-button field-button-light porta-catalog-link" href={portaRoyalCatalog} target="_blank" rel="noreferrer">Katalog proizvođača</a>
  </ModuleHeader>
  <main className="module-content">
    <div className="catalog-model-filters porta-filters">
     <label className="jobs-search"><Search aria-hidden="true"/><input type="search" aria-label="Pretraži sobna vrata" placeholder="Pretraži seriju, dekor ili tip…" value={search} onChange={event=>filter('q',event.target.value)}/></label>
     <select aria-label="Kolekcija" value={group} onChange={event=>filter('kolekcija',event.target.value)}><option value="">Sve kolekcije</option>{Object.entries(portaRoyalGroups).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select>
    </div>
    <p className="porta-count" role="status">{group||search?`${seriesList.length} serija za ovaj izbor`:`${Object.keys(portaRoyalGroups).length} kolekcija · ${portaRoyalSeries.length} serija · ${portaVariantCount} varijanti`}</p>
    {seriesList.length?<div className="porta-series-grid">{seriesList.map(series=>{
     const initial=portaDefaultSelection(series);
     return <button className="porta-series-card" key={series.id} onClick={()=>openSelection(initial)}><PortaPhoto selection={initial} lazy/><span><strong>{series.name}</strong><small>{series.decors.length} {series.decors.length===1?'dekor':'dekora'} · {Object.keys(series.variants).length} varijanti</small></span></button>;
    })}</div>:<Empty title="Nema sobnih vrata za ovaj izbor"/>}
  </main>
 </div>;
}

function PortaWorkspace({selection,size,onDimension,ral,children}:{
 selection:PortaSelection;size:ElementDimensions;onDimension:(key:keyof ElementDimensions,value:number)=>void;ral?:string;children:ReactNode;
}){
 return <main className="measurement-workspace porta-editor-workspace">
  <DimensionControls size={size} min={{width:1,height:1}} max={{width:portaMaxDimension,height:portaMaxDimension}} clearToZero onChange={onDimension}/>
  <section className="measurement-canvas porta-editor-preview">
   <PortaPhoto selection={selection} size={size} dimensions/>
   {ral?.trim()&&<p className="field-sketch-note">Fotografija prikazuje kataloški dekor. Naručena nijansa se navodi prema RAL oznaci.</p>}
   <PortaTechnicalDetails selection={selection}/>
  </section>
  <section className="porta-editor-fields" aria-label="Podešavanja sobnih vrata">{children}</section>
 </main>;
}

function withDoor(p:Position,config:PortaRoyalConfig):Position {
 const opening:Opening=portaSliding(config.type)?'Klizno':config.direction==='left'?'Levo':'Desno';
 const followsCatalog=!p.portaRoyal||p.name===portaPositionName(p.portaRoyal);
 return {...p,name:followsCatalog?portaPositionName(config):p.name,portaRoyal:config,segments:[{width:p.width,opening}]};
}

export function PortaEditor({catalogReturn}:{catalogReturn?:string}) {
 const {id,positionId}=useParams(),[params]=useSearchParams(),location=useLocation();
 const job=useStore(s=>s.jobs.find(job=>job.id===id)),settings=useStore(s=>s.settings);
 const original=job?.positions.find(p=>p.id===positionId);
 const selection=original?.portaRoyal??readSelection(params);
 if(id&&!job||positionId&&!original)return <MissingJob/>;
 if(!selection)return <Navigate to={portaCatalogPath(job?.id)} replace/>;
 const requestedSize=readDimensions(params,selection.type);
 const size=Object.values(requestedSize).every(isPortaDimension)?requestedSize:portaStartingSize(selection.type);
 const initial=original??withDoor({...makePosition(catalog[7]),...size,category:'Sobna vrata',elementType:'sobna-vrata',installation:false},portaConfiguration(selection));
 const back=original?`/posao/${id}`:catalogReturn??location.state?.catalogReturn??portaCatalogPath(job?.id);
 const draftSize=!original&&Object.values(dimensionParams).some(key=>params.has(key))?`:${size.width}x${size.height}`:'';
 return <PortaMeasurements initial={initial} jobId={job?.id} customer={job?.customer.name} back={back} editing={!!original} showPrices={settings.showPrices!==false} draftSize={draftSize}/>;
}

function PortaMeasurements({initial,jobId,customer,back,editing,showPrices,draftSize}:{initial:Position;jobId?:string;customer?:string;back:string;editing:boolean;showPrices:boolean;draftSize:string}) {
 const navigate=useNavigate(),settings=useStore(s=>s.settings);
 const start=initial.portaRoyal!;
 const key=workspaceDraftKey(`alu-porta-draft-v1:${jobId??'catalog'}:${editing?initial.id:`${start.series}:${start.decor}:${start.type}`}${draftSize}`);
 const [p,setP]=useState(()=>{
  try{
   const raw=sessionStorage.getItem(key);
   if(raw){
    const job=useStore.getState().jobs.find(job=>job.id===jobId)??jobFromSettings(settings);
    const draft=parseBackup({settings,jobs:[{...job,positions:[JSON.parse(raw)]}]}).jobs[0].positions[0];
    if(draft.portaRoyal)return draft;
   }
  }catch{/* Keep the saved position when a draft cannot be read. */}
  return initial;
 });
 const [newJobOpen,setNewJobOpen]=useState(false);
 const [draftError,setDraftError]=useState(false);
 const config=p.portaRoyal!,{series}=portaVariant(config)!,spec=portaTechnical(series),sliding=portaSliding(config.type);
 const errors=validatePosition(p),price=positionCost(p,settings);
 function patch(next:Position){
  setP(next);
  try{sessionStorage.setItem(key,JSON.stringify(next));setDraftError(false);}catch{setDraftError(true);}
 }
 function setConfig(next:Partial<PortaRoyalConfig>){patch(withDoor(p,{...config,...next}));}
 function select(next:PortaSelection){
  const defaults=portaConfiguration(next);
  const previousSize=portaStartingSize(config.type),nextSize=portaStartingSize(next.type);
  const size={
   width:!editing&&p.width===previousSize.width?nextSize.width:p.width,
   height:!editing&&p.height===previousSize.height?nextSize.height:p.height,
  };
  if(next.series!==config.series){patch(withDoor({...p,...size},{...defaults,wall:config.wall,direction:config.direction}));return;}
  const nextSliding=portaSliding(next.type);
  patch(withDoor({...p,...size},{...config,...next,hinge:nextSliding?undefined:config.hinge??defaults.hinge,lock:nextSliding?undefined:config.lock??defaults.lock,handle:nextSliding?undefined:config.handle}));
 }
 function finishSave(id:string){
  try{sessionStorage.removeItem(key);}catch{/* Job storage reports its own errors. */}
  navigate(`/posao/${id}`,{replace:!jobId});
 }
 function createJob(name:string){
  if(errors.length)return;
  const store=useStore.getState(),job=jobFromSettings(store.settings);
  store.addJob({...job,customer:{...job.customer,name},positions:[p]});
  finishSave(job.id);
 }
 function save(){
  if(errors.length)return;
  if(!jobId){setNewJobOpen(true);return;}
  const store=useStore.getState(),job=store.jobs.find(job=>job.id===jobId);
  if(!job)return;
  store.updateJob(jobId,{positions:editing?job.positions.map(position=>position.id===p.id?p:position):[...job.positions,p]});
  finishSave(jobId);
 }
 const title=customer?`${editing?'Izmeni sobna vrata':'Sobna vrata'} — ${customer}`:series.name;
 return <div className="field-page measuring-page porta-page">
  <FieldHeader title={title} back={back}/>
  <PortaWorkspace selection={config} size={p} ral={config.ral} onDimension={(key,value)=>patch(withDoor({...p,[key]:value},config))}>
    {!editing&&<p className="porta-size-hint">Početne mere otvora su približne.</p>}
    <div className="porta-card">
     <div className="field-options-grid">
      <Field label="Debljina zida (mm)" hint={`Raspon štoka ${spec.wall}`}><input type="number" inputMode="numeric" min={1} max={2000} value={config.wall??''} onChange={event=>setConfig({wall:event.target.value?Math.max(0,Math.min(2000,+event.target.value)):undefined})}/></Field>
      {config.type!=='dk'&&<Field label={sliding?'Smer klizanja':'Strana šarki'}><select value={config.direction} onChange={event=>setConfig({direction:event.target.value as PortaRoyalConfig['direction']})}><option value="left">{sliding?'Ulevo':'Levo'}</option><option value="right">{sliding?'Udesno':'Desno'}</option></select></Field>}
      <Field label="Količina"><NumberInput min={1} max={100} inputMode="numeric" value={p.quantity} onChange={event=>patch({...p,quantity:+event.target.value})}/></Field>
      <Field label="Naziv pozicije"><input value={p.name} maxLength={150} onChange={event=>patch({...p,name:event.target.value})}/></Field>
     </div>
    </div>
    <div className="porta-card">
     <Field label="Serija"><select value={series.id} onChange={event=>select(portaDefaultSelection(portaSeriesById(event.target.value)!))}>
      {Object.entries(portaRoyalGroups).map(([group,label])=><optgroup label={label} key={group}>{portaRoyalSeries.filter(item=>item.group===group).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}
     </select></Field>
     <PortaVariantOptions selection={config} onChange={select}/>
    </div>
    <details className="porta-card porta-equipment" open>
     <summary>Konstrukcija i oprema</summary>
     <div className="field-options-grid">
      <Field label="Ispuna"><select value={config.fill} onChange={event=>setConfig({fill:event.target.value as PortaRoyalConfig['fill']})}>{spec.fills.map(fill=><option key={fill} value={fill}>{portaFills[fill]}</option>)}</select></Field>
      {spec.ral&&<Field label="RAL po zahtevu"><input maxLength={24} placeholder="npr. 1014" value={config.ral??''} onChange={event=>setConfig({ral:event.target.value||undefined})}/></Field>}
      {!sliding&&<>
       <PortaOption label="Šarke" value={config.hinge} options={portaHinges} allowed={spec.hinges} onChange={hinge=>setConfig({hinge})}/>
       <PortaOption label="Brava" value={config.lock} options={portaLocks} onChange={lock=>setConfig({lock})}/>
       <PortaOption label="Kvaka" value={config.handle} options={portaHandles} onChange={handle=>setConfig({handle})}/>
      </>}
      {spec.cutouts&&<PortaOption label="Dodatni otvor" value={config.cutout} options={{O1:'O1',O2:'O2',O3:'O3'}} onChange={cutout=>setConfig({cutout})}/>}
      {spec.glazing&&<PortaOption label="Dekorativni staklići" value={config.glazing} options={portaGlazing} onChange={glazing=>setConfig({glazing})}/>}
     </div>
     <div className="field-checks porta-checks">
      {(['threshold','vent'] as const).map(option=><label key={option}><input type="checkbox" checked={!!config[option]} onChange={event=>setConfig({[option]:event.target.checked})}/>{portaOptions[option]}</label>)}
      <label><input type="checkbox" checked={p.installation} onChange={event=>patch({...p,installation:event.target.checked})}/>Montaža</label>
      <label><input type="checkbox" checked={p.removal} onChange={event=>patch({...p,removal:event.target.checked})}/>Demontaža</label>
     </div>
     <Field label="Napomena"><textarea rows={2} maxLength={2000} value={p.notes} onChange={event=>patch({...p,notes:event.target.value})}/></Field>
     {showPrices&&<Field label="Ručna cena po komadu (€)"><input type="number" inputMode="decimal" min={0} max={1e8} step="0.01" value={p.manualPrice??''} onChange={event=>{if(!event.target.validity.badInput)patch({...p,manualPrice:event.target.value?Math.max(0,Math.min(1e8,+event.target.value)):null});}}/></Field>}
    </details>
    {errors.length>0&&<p className="field-error" role="status">{errors[0]}</p>}
    {draftError&&<p className="field-error" role="alert">Nacrt nije sačuvan na uređaju. Sačuvajte vrata u poslu.</p>}
  </PortaWorkspace>
  <footer className="measurement-footer">{showPrices&&<div className="measurement-amount"><span>{p.quantity} kom.</span><strong>{positionPriceLabel(price,p)}</strong></div>}<button className="field-button field-button-yellow" onClick={save} disabled={errors.length>0}><Check/>{editing?'Sačuvaj izmene':'Dodaj u posao'}</button></footer>
  {newJobOpen&&<NewJobDialog onCreate={createJob} onClose={()=>setNewJobOpen(false)} submitLabel="Sačuvaj posao"/>}
 </div>;
}

function PortaOption<K extends string>({label,value,options,allowed,onChange}:{label:string;value?:K;options:Record<K,string>;allowed?:readonly K[];onChange:(value:K|undefined)=>void}) {
 return <Field label={label}><select value={value??''} onChange={event=>onChange(event.target.value?event.target.value as K:undefined)}>
  <option value="">Bez izbora</option>{(allowed??Object.keys(options) as K[]).map(key=><option key={key} value={key}>{options[key]}</option>)}
 </select></Field>;
}
