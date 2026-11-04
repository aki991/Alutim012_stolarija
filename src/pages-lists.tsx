import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, ChevronRight, Copy, FileText, LayoutGrid, MoreVertical, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from './store';
import { useNavigation } from './navigation';
import { jobStatuses, type Job } from './models';
import { JobStatus } from './components/JobStatus';
import { Empty, Modal } from './components/UI';
import { ModuleHeader } from './components/ModuleHeader';
import { catalog } from './catalog';
import { fieldTypes, typeOfPosition } from './field-types';
import { calculate, euro, jobPriceLabel } from './services/calculation';
import { Drawing } from './components/Drawing';
import { ElementGlyph } from './components/ElementGlyph';
export type CatalogChoice={type:string;template?:number};

export function Jobs({onNew,offers=false}:{onNew:()=>void;offers?:boolean}){
 const {jobs,settings,deleteJob,duplicateJob,updateJob}=useStore(),navigate=useNavigate(),[params]=useSearchParams();
 const [search,setSearch]=useState(''),[filter,setFilter]=useState(params.get('status')||'Sve'),[deleting,setDeleting]=useState<Job|null>(null);
 const filtered=jobs.filter(j=>(!offers||['Ponuda','Čeka proveru'].includes(j.status))&&(filter==='Sve'||filter===j.status)&&`${j.customer.name} ${j.customer.address} ${j.id}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="module-page"><ModuleHeader title={offers?'Ponude':'Svi poslovi'} subtitle={offers?'Pregled pripremljenih ponuda.':'Pregled, pretraga i nastavak rada na poslovima.'} icon={offers?FileText:BriefcaseBusiness}><button className="field-button field-button-yellow module-new-job" onClick={onNew}><Plus/>Novi posao</button></ModuleHeader>
  <main className="module-content"><div className="jobs-controls"><label className="jobs-search"><Search/><input aria-label="Pretraži poslove" placeholder="Pretraži posao…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="jobs-status-filters" role="group" aria-label="Status posla">{[['Sve','Svi'],...jobStatuses.map(s=>[s,s]),['Čeka proveru','Čeka proveru']].map(([value,label])=><button key={value} className={filter===value?'selected':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div></div>
   <div className="job-cards">{filtered.map(job=><article className="job-card" key={job.id}><div className="job-card-open"><Link to={`/posao/${job.id}`} className="job-card-sketch">{job.positions[0]?<Drawing position={job.positions[0]} compact/>:<BriefcaseBusiness/>}</Link><Link to={`/posao/${job.id}${offers?'/ponuda':''}`} className="job-card-info"><h2>{job.customer.name}</h2><p>{job.positions.length} {job.positions.length===1?'pozicija':'pozicije'} · {job.positions.reduce((n,p)=>n+p.quantity,0)} elemenata</p></Link><span className="job-card-status"><JobStatus value={job.status} name={job.customer.name} onChange={status=>{updateJob(job.id,{status});useStore.getState().retrySave();}}/></span><span className="job-card-value">{settings.showPrices!==false&&<strong>{jobPriceLabel(job,settings)}</strong>}<small>{job.date?new Date(job.date+'T12:00:00').toLocaleDateString('sr-Latn-RS'):'Datum nije naveden'}</small></span><Link to={`/posao/${job.id}`} aria-label={`Otvori ${job.customer.name}`}><ChevronRight className="job-card-arrow"/></Link>
    </div><details className="job-card-menu"><summary className="field-icon-button" aria-label={`Meni posla ${job.customer.name}`}><MoreVertical/></summary><div><button aria-label={`Dupliraj ${job.customer.name}`} onClick={()=>navigate(`/posao/${duplicateJob(job.id)}`)}><Copy/>Dupliraj</button><button aria-label={`Obriši ${job.customer.name}`} onClick={e=>{setDeleting(job);e.currentTarget.closest('details')?.removeAttribute('open');}}><Trash2/>Obriši</button></div></details>
   </article>)}</div>
   {!filtered.length&&<Empty title={offers?'Nema ponuda za ovaj izbor':'Nema poslova za ovaj izbor'} action={<button className="field-button field-button-yellow" onClick={onNew}><Plus/>Novi posao</button>}/>}
  </main>
  {deleting&&<Modal title="Obriši posao?" onClose={()=>setDeleting(null)}><p>Posao „{deleting.customer.name}“ i njegovi elementi biće uklonjeni sa ovog uređaja.</p><div className="modal-footer"><button className="field-button field-button-light" onClick={()=>setDeleting(null)}>Otkaži</button><button className="field-button field-button-red" onClick={()=>{deleteJob(deleting.id);setDeleting(null);}}>Obriši posao</button></div></Modal>}
 </div>;
}

export function Catalog({onUse}:{onUse:(choice:CatalogChoice)=>void}){
 const navigate=useNavigate(),jobs=useStore(s=>s.jobs),activeId=useNavigation(s=>s.jobId),active=jobs.find(j=>j.id===activeId),[selected,setSelected]=useState('');
 const quick=[...fieldTypes.filter(t=>t.id!=='ostalo').map(t=>({type:t.id,label:t.label,template:undefined as number|undefined})),{type:'balkonska',label:'Kombinacija',template:6}];
 function choose(choice:CatalogChoice){setSelected(choice.template===6?'kombinacija':choice.type);if(active)navigate(`/posao/${active.id}/nov/${choice.type}${choice.template===undefined?'':`?template=${choice.template}`}`);else onUse(choice);}
 return <div className="module-page catalog-page"><ModuleHeader title="Katalog elemenata" icon={LayoutGrid}/><main className="module-content">
  <div className="quick-catalog-grid">{quick.map(choice=><button key={choice.label} className={`quick-catalog-tile ${selected===(choice.template===6?'kombinacija':choice.type)?'selected':''}`} onClick={()=>choose(choice)}><ElementGlyph type={choice.template===6?'kombinacija':choice.type} wings={['prozor','klizni'].includes(choice.type)?2:1}/><span>{choice.label}</span></button>)}</div>
  <details className="catalog-models"><summary>Svi modeli</summary><div className="catalog-model-grid">{catalog.map((entry,index)=><button key={entry.name} onClick={()=>choose({type:entry.category==='Roletne'?'roletna':entry.category==='Komarnici'?'komarnik':entry.category==='Klizni sistemi'?'klizni':entry.category==='Vrata'||entry.category==='Ulazna vrata'?'vrata':entry.category==='Usluge'||entry.category==='Klupice'?'ostalo':'prozor',template:index})}><ElementGlyph type={entry.name.includes('sa prozorom')?'kombinacija':entry.fixed?'fiksni':entry.category==='Roletne'?'roletna':entry.category==='Komarnici'?'komarnik':entry.category==='Klizni sistemi'?'klizni':entry.category==='Vrata'||entry.category==='Ulazna vrata'?'vrata':'prozor'} wings={entry.wings}/><strong>{entry.name}</strong><small>{entry.width} × {entry.height} mm</small></button>)}</div></details>
 </main></div>;
}
