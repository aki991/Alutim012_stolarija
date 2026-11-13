import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, ChevronRight, Copy, FileText, LayoutGrid, MoreVertical, Plus, Search, Trash2 } from 'lucide-react';
import { assignedMeasurement, awaitingMeasurements, useStore } from './store';
import { isActiveJob, jobStatuses, type Job, type Package, type Settings } from './models';
import { useNavigation } from './navigation';
import { JobStatus } from './components/JobStatus';
import { Empty, Modal } from './components/UI';
import { ModuleHeader } from './components/ModuleHeader';
import { catalog } from './catalog';
import { makeFieldPosition, selectableFieldTypes } from './field-types';
import { catalogModels, modelGroups, type CatalogModel } from './catalog-models';
import { movements } from './model-layout';
import { euro, jobPriceLabel, positionCost } from './services/calculation';
import { Drawing } from './components/Drawing';
import { ElementGlyph } from './components/ElementGlyph';
import type { ElementDimensions } from './components/DimensionControls';
import { portaCatalogPath, type PortaSelection } from './porta-royal';
export type CatalogChoice={type:string;template?:number;model?:string;porta?:PortaSelection&{size?:ElementDimensions}};
export function catalogChoicePath(jobId:string,choice:CatalogChoice){
 const path=`/posao/${jobId}/nov/${choice.type}`;
 if(choice.porta){
  const {series,decor,type,size}=choice.porta;
  const params=new URLSearchParams({serija:series,dekor:decor,tip:type});
  if(size){params.set('sirina',String(size.width));params.set('visina',String(size.height));}
  return `${path}?${params}`;
 }
 if(choice.model)return `${path}?model=${encodeURIComponent(choice.model)}`;
 return choice.template===undefined?path:`${path}?template=${choice.template}`;
}

export function Jobs({onNew,offers=false}:{onNew:()=>void;offers?:boolean}){
 const state=useStore(),{jobs,settings,deleteJob,duplicateJob,updateJob,teamMember}=state,navigate=useNavigate(),[params]=useSearchParams();
 const [search,setSearch]=useState(''),[filter,setFilter]=useState(params.get('status')||'Sve'),[deleting,setDeleting]=useState<Job|null>(null);
 const selectedFilter = jobStatuses.some(status=>status===filter) ? filter : 'Sve';
 const filtered=jobs.filter(j=>(offers?j.status==='Ponuda'||j.status==='Poslati ponudu':selectedFilter==='Sve'||selectedFilter===j.status)&&`${j.customer.name} ${j.customer.address} ${j.id}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="module-page"><ModuleHeader title={offers?'Ponude':'Svi poslovi'} subtitle={offers?'Pregled pripremljenih ponuda i poslova koji čekaju slanje ponude.':'Pregled, pretraga i nastavak rada na poslovima.'} icon={offers?FileText:BriefcaseBusiness}><button className="field-button field-button-yellow module-new-job" onClick={onNew}><Plus/>Novi posao</button></ModuleHeader>
  <main className="module-content"><div className="jobs-controls"><label className="jobs-search"><Search/><input aria-label="Pretraži poslove" placeholder="Pretraži posao…" value={search} onChange={e=>setSearch(e.target.value)}/></label>{!offers&&<div className="jobs-status-filters" role="group" aria-label="Status posla">{[['Sve','Svi'],...jobStatuses.map(status=>[status,status])].map(([value,label])=><button key={value} className={selectedFilter===value?'selected':''} aria-pressed={selectedFilter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>}</div>
   <div className="job-cards">{filtered.map(job=>{
    const waiting=awaitingMeasurements(state,job);
    return <article className="job-card" key={job.id}><div className="job-card-open"><Link to={`/posao/${job.id}`} className="job-card-sketch">{!waiting&&job.positions[0]?<Drawing position={job.positions[0]} compact/>:<BriefcaseBusiness/>}</Link><Link to={`/posao/${job.id}${offers?'/ponuda':''}`} className="job-card-info"><h2>{job.customer.name}</h2><p>{waiting?'Čeka završetak merenja':`${job.positions.length} ${job.positions.length===1?'pozicija':'pozicije'} · ${job.positions.reduce((n,p)=>n+p.quantity,0)} elemenata`}</p></Link><span className="job-card-status"><JobStatus value={job.status} name={job.customer.name} locked={assignedMeasurement(state,job)} onChange={status=>{updateJob(job.id,{status});useStore.getState().retrySave();}}/></span><span className="job-card-value">{!waiting&&settings.showPrices!==false&&<strong>{jobPriceLabel(job,settings)}</strong>}<small>{job.date?new Date(job.date+'T12:00:00').toLocaleDateString('sr-Latn-RS'):'Datum nije naveden'}</small></span><Link to={`/posao/${job.id}`} aria-label={`Otvori ${job.customer.name}`}><ChevronRight className="job-card-arrow"/></Link>
    </div><details className="job-card-menu"><summary className="field-icon-button" aria-label={`Meni posla ${job.customer.name}`}><MoreVertical/></summary><div>{!waiting&&<button aria-label={`Dupliraj ${job.customer.name}`} onClick={()=>navigate(`/posao/${duplicateJob(job.id)}`)}><Copy/>Dupliraj</button>}{teamMember?.role!=='worker'&&<button aria-label={`Obriši ${job.customer.name}`} onClick={e=>{setDeleting(job);e.currentTarget.closest('details')?.removeAttribute('open');}}><Trash2/>Obriši</button>}</div></details>
   </article>;})}</div>
   {!filtered.length&&<Empty title={offers?'Nema ponuda za ovaj izbor':'Nema poslova za ovaj izbor'} action={<button className="field-button field-button-yellow" onClick={onNew}><Plus/>Novi posao</button>}/>}
  </main>
  {deleting&&<Modal title="Obriši posao?" onClose={()=>setDeleting(null)}><p>Posao „{deleting.customer.name}“ i njegovi elementi biće uklonjeni {teamMember?'iz zajedničke baze':'sa ovog uređaja'}.</p><div className="modal-footer"><button className="field-button field-button-light" onClick={()=>setDeleting(null)}>Otkaži</button><button className="field-button field-button-red" onClick={()=>{deleteJob(deleting.id);setDeleting(null);}}>Obriši posao</button></div></Modal>}
 </div>;
}

const legacyModels=[{type:'kombinacija',template:6},{type:'roletna',template:13},{type:'komarnik',template:14},{type:'ostalo',template:15},{type:'ostalo',template:16}];
const pageSize=24;
const normalize=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[đĐ]/g,'dj').toLowerCase();
const firstModels=[
 'w-turn-plain_right','w-mixed-plain-right','w-fixed-1-1','d-entrance-glass-top-sides-l',
 'd-balcony-panel-plain-r','s-hs-d-slideRight-fixed','f-d-out-1-3','shape-arch','r-pivot-1',
 'facade-parallel-4-3','a-tel-fixed-slideLeft-slideLeft','g-sectional',
];
const modelSearch=[...catalogModels].sort((a,b)=>{
 const rank=(id:string)=>{const index=firstModels.indexOf(id);return index===-1?firstModels.length:index;};
 return rank(a.id)-rank(b.id);
}).map(model=>{
 const cells=model.layout?.rows.flatMap(row=>row.cells)??[];
 const openings=new Set(cells.map(cell=>movements[cell.movement]));
 const moving=cells.filter(cell=>cell.movement!=='fixed').length;
 const wingCount=['','jednokrilni jednokrilna','dvokrilni dvokrilna','trokrilni trokrilna','četvorokrilni četvorokrilna'][moving]??'';
 return {model,terms:normalize(`${model.name} ${model.category} ${modelGroups[model.group]} ${model.keywords??''} ${wingCount} ${[...openings].join(' ')}`)};
});
const sketchCache=new Map<string,ReturnType<typeof makeFieldPosition>>();

function ModelCard({model,onClick,settings,tier}:{model:CatalogModel;onClick:()=>void;settings:Settings;tier:Package}){
 let sketch=sketchCache.get(model.id);
 if(!sketch){sketch=makeFieldPosition(model.shape?'nacrtaj':'model',undefined,model.id);sketchCache.set(model.id,sketch);}
 return <button type="button" onClick={onClick}><Drawing position={sketch} compact/><strong>{model.name}</strong><small>{model.width} × {model.height} mm</small>{settings.showPrices!==false&&<small className="catalog-model-price">{euro(positionCost({...sketch,...settings.elementDefaults},settings,tier).unit)}</small>}</button>;
}

export function Catalog({onUse}:{onUse:(choice:CatalogChoice)=>void}){
 const navigate=useNavigate(),location=useLocation(),{id}=useParams(),jobs=useStore(s=>s.jobs),settings=useStore(s=>s.settings),activeId=useNavigation(s=>s.jobId);
 const active=jobs.find(job=>id?job.id===id:job.id===activeId&&isActiveJob(job));
 const [params,setParams]=useSearchParams();
 const search=params.get('q')??'',selectedGroup=params.get('grupa')??'',requested=Number(params.get('strana'))||1;
 const group=selectedGroup==='other'||Object.hasOwn(modelGroups,selectedGroup)?selectedGroup:'';
 const terms=normalize(search).trim().split(/\s+/).filter(Boolean);
 const results=group==='other'?[]:modelSearch.filter(entry=>(!group||entry.model.group===group)&&terms.every(term=>entry.terms.includes(term)));
 const legacy=!group||group==='other'?legacyModels.filter(choice=>terms.every(term=>normalize(catalog[choice.template].name).includes(term))):[];
 const total=results.length+legacy.length;
 const pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.max(1,Math.min(pages,Math.trunc(requested))),start=(page-1)*pageSize,end=start+pageSize;
 const sectionId='catalog-model-browser';
 function update(key:string,value:string){
  const next=new URLSearchParams(params);
  if(value)next.set(key,value);else next.delete(key);
  if(key!=='strana')next.delete('strana');
  setParams(next,{replace:true});
 }
 function choose(choice:CatalogChoice){
  const returnTo=location.pathname+location.search+(!id&&(choice.model||choice.template!==undefined)?`#${sectionId}`:'');
  if(active)navigate(catalogChoicePath(active.id,choice),{state:{catalogReturn:returnTo}});else onUse(choice);
 }
 if(id&&!active)return <Empty title="Posao nije pronađen" action={<Link className="field-button field-button-yellow" to="/poslovi">Svi poslovi</Link>}/>;
 return <div className="module-page catalog-page"><ModuleHeader title="Katalog elemenata" subtitle={active?.customer.name} icon={LayoutGrid}>{id&&active&&<Link className="field-button field-button-light" to={`/posao/${active.id}/dodaj`}>Izbor elementa</Link>}</ModuleHeader><main className="module-content">
  {!id?<><a className="catalog-jump" href={`#${sectionId}`}>Pretraži sve modele <ChevronRight size={18}/></a><div className="quick-catalog-grid">{selectableFieldTypes.map(({id:type,label})=><button key={type} className="quick-catalog-tile" onClick={()=>choose({type})}><ElementGlyph type={type} wings={['prozor','klizni'].includes(type)?2:1}/><span>{label}</span></button>)}<Link className="quick-catalog-tile" to={portaCatalogPath()}><ElementGlyph type="sobna-vrata"/><span>Sobna vrata</span></Link></div></>:<Link className="catalog-jump" to={portaCatalogPath(id)}>Sobna vrata · Porta Royal <ChevronRight size={18}/></Link>}
  <section id={sectionId} className="catalog-models">
   <div className="catalog-model-header">
    <h2>Svi modeli</h2>
    <div className="catalog-model-filters">
     <label className="jobs-search"><Search aria-hidden="true"/><input type="search" aria-label="Pretraži modele" placeholder="Pretraži modele…" value={search} onChange={e=>update('q',e.target.value)}/></label>
     <select aria-label="Grupa modela" value={group} onChange={e=>update('grupa',e.target.value)}><option value="">Sve grupe</option>{Object.entries(modelGroups).map(([key,name])=><option key={key} value={key}>{name}</option>)}<option value="other">Oprema i kombinacija</option></select>
    </div>
    <p role="status">{total?`${start+1}–${Math.min(end,total)} od ${total.toLocaleString('sr-Latn-RS')} modela`:'Nema modela za ovaj izbor.'}</p>
   </div>
   {total>0&&<div className="catalog-model-grid">
    {results.slice(start,end).map(({model})=><ModelCard key={model.id} model={model} settings={settings} tier={active?.package??'Standard'} onClick={()=>choose({type:model.shape?'nacrtaj':'model',model:model.id})}/>)}
    {legacy.slice(Math.max(0,start-results.length),Math.max(0,end-results.length)).map(choice=>{
     const entry=catalog[choice.template];
     return <button key={choice.template} onClick={()=>choose(choice)}><ElementGlyph type={choice.type} wings={entry.wings}/><strong>{entry.name}</strong><small>{entry.width} × {entry.height} mm</small>{settings.showPrices!==false&&<small className="catalog-model-price">{euro(positionCost({...makeFieldPosition(choice.type,choice.template),...settings.elementDefaults},settings,active?.package).unit)}</small>}</button>;
    })}
   </div>}
   {pages>1&&<nav className="catalog-model-pagination" aria-label="Strane kataloga">
    <button className="field-button field-button-light" disabled={page===1} onClick={()=>{update('strana',String(page-1));document.getElementById(sectionId)?.scrollIntoView();}}>Prethodna</button>
    <label>Strana <select aria-label="Strana kataloga" value={page} onChange={e=>{update('strana',e.target.value);document.getElementById(sectionId)?.scrollIntoView();}}>{Array.from({length:pages},(_,i)=><option key={i+1}>{i+1}</option>)}</select> od {pages}</label>
    <button className="field-button field-button-light" disabled={page===pages} onClick={()=>{update('strana',String(page+1));document.getElementById(sectionId)?.scrollIntoView();}}>Sledeća</button>
   </nav>}
  </section>
 </main></div>;
}
