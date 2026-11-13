import { NumberInput } from './components/NumberInput';
import { fmt } from './custom/geometry';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, Copy, Expand, Minus, MoreVertical, Pencil, Plus, RotateCcw, Settings2, Trash2, UserRound, X } from 'lucide-react';
import { assignedMeasurement, awaitingMeasurements, useStore, workspaceDraftKey } from './store';
import type { Opening, Position } from './models';
import { uid } from './catalog';
import { calculate, euro, positionCost, validatePosition, positionPriceLabel, jobReviewLabel } from './services/calculation';
import { parseBackup } from './services/storage';
import { fieldTypes, makeFieldPosition, selectableFieldTypes, typeOfPosition } from './field-types';
import { Empty, Modal, Saved } from './components/UI';
import { centralWidth } from './fixed-panels';
import { CombinationControls } from './components/CombinationControls';
import { FixedPanelPicker } from './components/FixedPanelPicker';
import { Drawing } from './components/Drawing';
import { DimensionControls } from './components/DimensionControls';
import { ElementGlyph } from './components/ElementGlyph';
import { FieldHeader } from './components/FieldHeader';
import { PositionOptions } from './components/PositionOptions';
import { ShutterControls } from './components/ShutterControls';
import { openingBoxHeight, shutterOf } from './shutters';
import { JobStatus } from './components/JobStatus';
import { JobForm } from './components/JobForm';
import { ModelLayoutControls } from './components/ModelLayoutControls';
import { maxModelDimension } from './model-layout';
import { findCatalogModel } from './catalog-models';
import { portaCatalogPath, portaRoyalTypes } from './porta-royal';
import { TeamJobPanel } from './pages-team';

export function TypeChooser(){
 const {id}=useParams(),job=useStore(s=>s.jobs.find(j=>j.id===id));
 if(!job)return <MissingJob/>;
 return <div className="field-page"><FieldHeader title={`Novi posao: ${job.customer.name}`} back={`/posao/${job.id}`}/><main className="type-chooser"><div className="type-grid">
 {selectableFieldTypes.map(type=><Link key={type.id} className="type-tile" to={`/posao/${job.id}/nov/${type.id}`}><ElementGlyph type={type.id} wings={['prozor','klizni'].includes(type.id)?2:1}/><span>{type.label}</span></Link>)}
 <Link className="type-tile" to={portaCatalogPath(job.id)}><ElementGlyph type="sobna-vrata"/><span>Sobna vrata</span></Link>
 </div><Link className="field-button field-button-light type-catalog-link" to={`/posao/${job.id}/modeli`}>Pretraži sve modele <ChevronRight size={18}/></Link></main></div>;
}
export function MissingJob(){return <Empty title="Posao nije pronađen" action={<Link className="field-button field-button-yellow" to="/poslovi">Svi poslovi</Link>}/>;}

export function Editor(){
 const {id}=useParams(),state=useStore(),{jobs,settings,updateJob,saveState,teamMember}=state,job=jobs.find(j=>j.id===id);
 const [dataOpen,setDataOpen]=useState(false),[deleting,setDeleting]=useState<Position|null>(null);
 if(!job)return <MissingJob/>;
 const waiting=awaitingMeasurements(state,job),statusLocked=assignedMeasurement(state,job);
 const total=calculate(job,settings);
 function duplicate(p:Position){updateJob(job!.id,{positions:[...job!.positions,{...structuredClone(p),id:uid(),name:p.name+' (kopija)'}]});}
 function move(index:number,by:number){const positions=[...job!.positions];[positions[index],positions[index+by]]=[positions[index+by],positions[index]];updateJob(job!.id,{positions});}
 return <div className="field-page summary-page"><FieldHeader title={`Posao: ${job.customer.name}`} back="/poslovi"/>
 <main className="job-summary">
  <div className="summary-customer"><button aria-label="Podaci o kupcu" className="summary-customer-info" onClick={()=>setDataOpen(true)}><UserRound/><span><strong>{job.customer.name}</strong><small>{job.customer.address||'Dodaj podatke o kupcu'}</small></span><Pencil size={18}/></button><JobStatus value={job.status} name={job.customer.name} locked={statusLocked} onChange={status=>{updateJob(job.id,{status});useStore.getState().retrySave();}}/></div><div className="summary-toolbar"><Saved state={saveState} shared={Boolean(teamMember)}/></div>
  {waiting?<section className="team-card team-measurement-wait"><h2>Merenje je u toku</h2><p>Elementi, mere i ponuda biće dostupni kad majstor potvrdi završetak merenja.</p></section>:
  !job.positions.length?<Empty title="Dodajte prvi element" action={<Link className="field-button field-button-red" to={`/posao/${job.id}/dodaj`}><Plus/>Dodaj element</Link>}/>:
  <div className={settings.showPrices===false?"summary-grid without-prices":"summary-grid"}><section className="job-lines" aria-label="Elementi posla"><div className="job-line-head"><span>#</span><span>Element</span><span>Dimenzije (mm)</span><span>Kom.</span>{settings.showPrices!==false&&<span>Cena</span>}<span/></div>
   {job.positions.map((p,i)=><article className="job-line" key={p.id}>
    <span className="line-number">{i+1}.</span>
    <Link className="line-element" to={`/posao/${job.id}/element/${p.id}`}><span className="line-sketch"><Drawing position={p} compact/></span><strong>{p.name}</strong></Link>
    <span className="line-dimensions">{fmt(p.width)} × {fmt(p.height+openingBoxHeight(p))}<span className="line-quantity-inline">{p.quantity} kom.</span><small>{p.portaRoyal?`Tip ${portaRoyalTypes[p.portaRoyal.type]}`:p.modelLayout?`${p.modelLayout.rows.reduce((n,row)=>n+row.cells.filter(cell=>cell.infill!=='space').length,0)} polja`:`${p.segments.length} ${p.segments.length===1?'krilo':'krila'}`}</small></span>
    <span className="line-quantity">{p.quantity}<small> kom.</small></span>
    {settings.showPrices!==false&&<strong className="line-price">{positionPriceLabel(total.positions[i],p)}</strong>}
    <div className="line-tools"><Link to={`/posao/${job.id}/element/${p.id}`} className="field-icon-button" aria-label={`Izmeni element ${i+1}`}><Pencil/></Link><details className="line-menu"><summary className="field-icon-button" aria-label={`Meni elementa ${i+1}`}><MoreVertical/></summary><div>
      <button onClick={e=>{duplicate(p);e.currentTarget.closest('details')?.removeAttribute('open');}}><Copy/>Dupliraj</button>
      <button disabled={i===0} onClick={e=>{move(i,-1);e.currentTarget.closest('details')?.removeAttribute('open');}}><ArrowUp/>Pomeri gore</button>
      <button disabled={i===job.positions.length-1} onClick={e=>{move(i,1);e.currentTarget.closest('details')?.removeAttribute('open');}}><ArrowDown/>Pomeri dole</button>
      <button onClick={e=>{setDeleting(p);e.currentTarget.closest('details')?.removeAttribute('open');}}><Trash2/>Obriši</button>
    </div></details></div>
   </article>)}
  </section>{settings.showPrices!==false&&<aside className="summary-price"><div><span>{(total.manual||total.vatMode==='inclusive')?'Osnovica bez PDV-a':'Elementi, radovi i transport'}</span><strong>{euro(total.manual||total.vatMode==='inclusive'?total.net:total.subtotal)}</strong></div>{total.discount>0&&<div><span>Popust {job.discountMode==='amount'?'':`${job.discount}%`}</span><strong>−{euro(total.discount)}</strong></div>}<>{total.surcharge>0&&<div><span>Uvećanje</span><strong>{euro(total.surcharge)}</strong></div>}{total.manual&&<p>Ručna ukupna cena</p>}</><div><span>{total.vatMode==='none'?'Bez obračuna PDV-a':`PDV ${total.vat}%${total.vatMode==='inclusive'?' (uključen)':''}`}</span><strong>{euro(total.tax)}</strong></div><section><h2>{total.hasUnpriced?'Zbir poznatih stavki':'Okvirna cena'}</h2><strong data-testid="job-total">{euro(total.total)}</strong></section><p>{total.hasUnpriced?jobReviewLabel(job,total)+'. Zbir obuhvata stavke sa izračunatom cenom.':'Demonstracione cene. Konačnu ponudu potvrđuje kancelarija.'}</p></aside>}</div>}
  <TeamJobPanel job={job}/>
 </main>
 {!waiting&&<footer className="field-bottom-actions job-quick-actions"><Link className="field-button field-button-red" to={`/posao/${job.id}/dodaj`}><Plus/>Dodaj element</Link>{settings.showPrices!==false&&<Link className="field-button field-button-light" to={`/posao/${job.id}/korekcija`}><Settings2/>Korekcija cene</Link>}<Link className="field-button field-button-yellow summary-more-offer" to={`/posao/${job.id}/ponuda`}>{settings.showPrices===false?"Pregledaj i podeli dokument":"Pogledaj cenu i podeli dokument"} <ArrowRight size={18}/></Link></footer>}
 {dataOpen&&<JobForm job={job} statusLocked={statusLocked} onClose={()=>setDataOpen(false)} onSave={(j,baseline)=>{updateJob(job.id,j,baseline);setDataOpen(false);}}/>}
 {deleting&&<Modal title="Obriši element?" onClose={()=>setDeleting(null)}><p>{deleting.name}</p><div className="modal-footer"><button className="field-button field-button-light" onClick={()=>setDeleting(null)}>Otkaži</button><button className="field-button field-button-red" onClick={()=>{updateJob(job.id,{positions:job.positions.filter(p=>p.id!==deleting.id)});setDeleting(null);}}>Obriši element</button></div></Modal>}
 </div>;
}

export function ElementEditor(){
 const {id,type,positionId}=useParams(),[params]=useSearchParams(),navigate=useNavigate(),location=useLocation();
 const {jobs,settings,updateJob}=useStore(),job=jobs.find(j=>j.id===id),original=job?.positions.find(p=>p.id===positionId);
 const template=params.has('template')?Number(params.get('template')):undefined;
 const model=findCatalogModel(params.get('model'));
 const draftKey=workspaceDraftKey(`alu-position-draft-v1:${id}:${positionId||(template===6?'kombinacija':type)}:${model?.id??(template===6?'':template??'')}`);
 const [p,setPosition]=useState<Position>(()=>{
  const initial=original?structuredClone(original):{...makeFieldPosition(type||'prozor',template,model?.id),...settings.elementDefaults};
  if(!job)return initial;
  try{const raw=sessionStorage.getItem(draftKey);if(raw){const draft=JSON.parse(raw);return parseBackup({settings,jobs:[{...job,positions:[draft]}]}).jobs[0].positions[0];}}catch{/* An unusable draft never changes the saved job. */}
  return initial;
 });
 const [chosen,setChosen]=useState<number|null>(null),[options,setOptions]=useState(false),[expanded,setExpanded]=useState(false),[zoom,setZoom]=useState(1),[message,setMessage]=useState(''),[draftError,setDraftError]=useState(false);
 const [layout,setLayout]=useState(false);
 const positionRef=useRef(p);
 useEffect(()=>{try{sessionStorage.setItem(draftKey,JSON.stringify(p));setDraftError(false);}catch{setDraftError(true);}},[draftKey,p]);
 if(!job||positionId&&!original)return <MissingJob/>;
 const combination=p.combination,modelLayout=p.modelLayout;
 const boxInHeight=openingBoxHeight(p);
 const measured={width:p.width,height:p.height+boxInHeight};
 const dimensionLimit=(key:'width'|'height')=>(modelLayout?maxModelDimension:key==='width'?6000:3500)+(key==='height'?boxInHeight:0);
 const heightLabel=boxInHeight?'Visina otvora (mm)':'Visina (mm)';
 const standaloneShutter=p.category==='Roletne'?shutterOf(p):undefined;
 const mode=combination?'kombinacija':type||typeOfPosition(p),special=['roletna','komarnik','ostalo'].includes(mode),isFixed=mode==='fiksni',isSliding=mode==='klizni',isDoor=['vrata','balkonska'].includes(mode);
 const errors=validatePosition(p),price=positionCost(p,settings,job.package);
 const persist=(next:Position)=>{positionRef.current=next;try{sessionStorage.setItem(draftKey,JSON.stringify(next));setDraftError(false);}catch{setDraftError(true);}setPosition(next);};
 const patch=(value:Partial<Position>)=>persist({...positionRef.current,...value});
 const dimension=(key:'width'|'height',value:number)=>{
  const previous=positionRef.current;
  if(key==='height'){patch({height:value-openingBoxHeight(previous)});return;}
  if(previous.modelLayout){patch({width:value,segments:[{width:value,opening:'Fiksno'}]});return;}
  const oldWidth=centralWidth(previous.width,previous.fixedPanels),newWidth=Math.max(0,centralWidth(value,previous.fixedPanels));
  persist({...previous,width:value,segments:previous.segments.map(s=>({...s,width:oldWidth>0?Math.round(s.width/oldWidth*newWidth*100)/100:newWidth/previous.segments.length}))});
 };
 const count=(n:number)=>{patch({segments:Array.from({length:n},(_,i)=>({width:centralWidth(p.width,p.fixedPanels)/n,opening:isFixed||special?'Fiksno':isSliding?'Klizno':p.segments[i]?.opening||(i===0?'Levo + kip':'Desno')}))});setChosen(null);setMessage('');};
 const opening=(value:string)=>{
  if(value==='pair'){
   if(p.segments.length<2){setMessage('Za levo + desno izaberite najmanje dva krila.');return;}
   patch({segments:p.segments.map((s,i)=>({...s,opening:i===0?'Levo':i===p.segments.length-1?'Desno':'Fiksno'}))});setChosen(null);
  }else patch({segments:p.segments.map((s,i)=>chosen===null||chosen===i?{...s,opening:value as Opening}:s)});
  setMessage('');
 };
 const activeOpening=chosen!==null?p.segments[chosen]?.opening:p.segments.length>=2&&p.segments[0].opening==='Levo'&&p.segments.at(-1)?.opening==='Desno'?'pair':p.segments.every(s=>s.opening===p.segments[0].opening)?p.segments[0].opening:'';
 const openingChoices=isSliding?[['Klizno','Klizno'],['Fiksno','Fiksno']]:isFixed||special?[['Fiksno','Fiksno']]:[['Levo + kip','Levo + kip'],['Desno + kip','Desno + kip'],['Levo','Levo'],['Desno','Desno'],['Kip','Kip / otklop'],['Fiksno','Fiksno'],['pair','Levo + desno']];
 const save=()=>{
  if(errors.length){setMessage(errors[0]);return;}
  const current=useStore.getState().jobs.find(j=>j.id===job.id);if(!current)return;
  updateJob(job.id,{positions:original?current.positions.map(pos=>pos.id===original.id?p:pos):[...current.positions,p]});
  try{sessionStorage.removeItem(draftKey);}catch{/* Store reports any persistent storage error separately. */}
  navigate(`/posao/${job.id}`);
 };
 const drawing=<><div className="field-canvas-toolbar"><span>{modelLayout?.cornerAfter?'Razvijeni pogled':chosen===null?'Pogled iznutra':`Izabrano krilo ${chosen+1}`}</span><div><button className="field-icon-button" aria-label="Resetuj prikaz" onClick={()=>setZoom(1)}><RotateCcw/></button><button className="field-icon-button" aria-label="Proširi prikaz" onClick={()=>setExpanded(true)}><Expand/></button></div></div><div className="field-drawing"><Drawing position={p} selected={chosen??-1} onSelect={combination||modelLayout?undefined:setChosen} zoom={zoom}/></div></>;
 return <div className="field-page measuring-page"><FieldHeader title={`${original?'Izmeni element':modelLayout?p.name:fieldTypes.find(t=>t.id===mode)?.label||'Element'} — ${job.customer.name}`} back={original?`/posao/${job.id}`:location.state?.catalogReturn??`/posao/${job.id}/${model?'modeli':'dodaj'}`}/>
 <main className="measurement-workspace"><section className="measurement-canvas">{drawing}<p className="field-sketch-note">Terenska skica · potrebna tehnička provera</p></section>
 <section className="measurement-controls" aria-label="Podešavanja elementa">{combination?<CombinationControls position={p} combination={combination} onChange={patch}/>:<>
 <DimensionControls size={measured} min={{width:200,height:200+boxInHeight}} max={{width:dimensionLimit('width'),height:dimensionLimit('height')}} heightLabel={heightLabel} onChange={dimension}/>
 {standaloneShutter&&<ShutterControls position={p} config={standaloneShutter} onChange={shutterConfig=>patch({shutterConfig})}/>}
 {modelLayout?<ModelLayoutControls layout={modelLayout} width={p.width} height={p.height} onChange={modelLayout=>patch({modelLayout})}/>:<>
 {(mode==='prozor'||isDoor)&&<button className="field-options-button fixed-panel-trigger" onClick={()=>setLayout(true)}><Settings2/>Raspored fiksnih polja<ChevronRight/></button>}
 {!special&&<section className="visual-control"><h2>Broj krila</h2><div className="wing-count-options" role="group" aria-label="Broj krila">{(isDoor?[1,2]:p.segments.length===4?[1,2,3,4]:[1,2,3]).map(n=><button key={n} className={p.segments.length===n?'selected':''} aria-pressed={p.segments.length===n} aria-label={n===1?'Jedno krilo':n===2?'Dva krila':n===3?'Tri krila':'Četiri krila'} onClick={()=>count(n)}><ElementGlyph type="prozor" wings={n}/><span>{n===1?'Jedno':n===2?'Dva':n===3?'Tri':'Četiri'}</span></button>)}</div></section>}
 {!special&&<section className="visual-control"><div className="opening-heading"><h2>Otvaranje</h2>{chosen!==null&&<button className="field-text-button" onClick={()=>setChosen(null)}>Sva krila</button>}</div><div className="opening-options" role="group" aria-label="Otvaranje">{openingChoices.map(([value,label])=><button key={value} className={activeOpening===value?'selected':''} aria-pressed={activeOpening===value} onClick={()=>opening(value)}><ElementGlyph type={value==='Fiksno'?'fiksni':isSliding?'klizni':'prozor'} wings={value==='pair'?2:1} opening={value==='pair'?undefined:value}/><span>{label}</span></button>)}</div></section>}</>}</>}
 <section className="visual-control material-control"><h2>Materijal</h2><div role="group" aria-label="Materijal">{(['PVC','ALU'] as const).map(material=><button key={material} aria-pressed={p.material===material} className={p.material===material?'selected':''} onClick={()=>patch({material,profile:material==='PVC'?'PVC 70 mm':'ALU termo profil'})}>{material}</button>)}</div></section>
 <button className="field-options-button" onClick={()=>setOptions(true)}><Settings2/>Dodatne opcije<ChevronRight/></button>
 {(errors.length>0||message)&&<div className="field-error" role="alert">{message||errors[0]}</div>}
 {draftError&&<p className="field-error" role="alert">Nacrt se ne može sačuvati. Dodajte element pre napuštanja ekrana.</p>}
 </section></main>
 <footer className="measurement-footer">{settings.showPrices!==false&&<div className="measurement-amount"><span>Okvirno · {p.quantity} {p.quantity===1?'komad':'komada'}</span><strong>{errors.length?'—':positionPriceLabel(price)}</strong></div>}<button className="field-button field-button-yellow" onClick={save} disabled={errors.length>0}><Check/>{original?'Sačuvaj izmene':'Dodaj u posao'}</button></footer>
 {layout&&<FixedPanelPicker position={p} isDoor={isDoor} onClose={()=>setLayout(false)} onApply={next=>{persist(next);setChosen(null);setMessage('');setLayout(false);}}/>}
 {options&&<PositionOptions position={p} automaticUnit={price.calculated} onChange={patch} onClose={()=>setOptions(false)}/>}
 {expanded&&<Modal title="Prošireni crtež" wide onClose={()=>setExpanded(false)}><div className="expanded-zoom" role="group" aria-label="Uvećanje crteža"><button className="field-icon-button" aria-label="Umanji crtež" disabled={zoom<=.7} onClick={()=>setZoom(Math.max(.7,zoom-.1))}><Minus/></button><button className="field-text-button" onClick={()=>setZoom(1)}>Resetuj prikaz</button><button className="field-icon-button" aria-label="Uvećaj crtež" disabled={zoom>=1.4} onClick={()=>setZoom(Math.min(1.4,zoom+.1))}><Plus/></button></div><div className="field-expanded-drawing"><Drawing position={p} selected={chosen??-1} onSelect={combination?undefined:setChosen} zoom={zoom}/></div>{!combination&&<div className="expanded-measures">{([['width','Širina (mm)'],['height',heightLabel]] as const).map(([key,label])=><label key={key}>{label}<NumberInput aria-label={label} inputMode="numeric" value={measured[key]} onChange={e=>dimension(key,+e.target.value)}/></label>)}</div>}</Modal>}
 </div>;
}
