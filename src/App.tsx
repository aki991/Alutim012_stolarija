import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, FolderOpen, Search } from 'lucide-react';
import { awaitingMeasurements, discardConflictingTeamChange, jobFromSettings, useStore } from './store';
import type { Job } from './models';
import { Empty, Modal } from './components/UI';
import { NewJobDialog } from './components/NewJobDialog';
import { AppShell } from './components/AppShell';
import { Dashboard } from './pages-dashboard';
import { Catalog, Jobs, catalogChoicePath, type CatalogChoice } from './pages-lists';
import { SettingsPage } from './pages-settings';
import { Editor, TypeChooser, ElementEditor } from './pages-editor';
import { CustomEditor } from './custom/CustomEditor';
import { Quote } from './pages-quote';
import { Correction } from './pages-correction';
import { findCatalogModel } from './catalog-models';
import { PortaCatalog, PortaEditor } from './pages-porta-royal';
import { TeamPage } from './pages-team';
import type { ReactNode } from 'react';

export default function App(){
 const {jobs,settings,addJob,storageError,retrySave,teamMember,teamConflict}=useStore(),navigate=useNavigate(),location=useLocation();
 const [draft,setDraft]=useState<{job:Job;choice?:CatalogChoice}|null>(null),[searchOpen,setSearchOpen]=useState(false),[search,setSearch]=useState(''),[notifications,setNotifications]=useState(false);
 const newJob=(choice?:CatalogChoice)=>setDraft({job:{...jobFromSettings(settings),...(teamMember?{status:'Merenje' as const}:{})},choice});
 useEffect(()=>{setDraft(null);setSearchOpen(false);setNotifications(false);},[location.pathname]);
 return <AppShell onNavigation={()=>{setDraft(null);setSearchOpen(false);setNotifications(false);}} onNew={()=>newJob()} onSearch={()=>setSearchOpen(true)} onNotifications={()=>teamMember?navigate('/tim'):setNotifications(true)}>
  {storageError&&<div className="storage-error" role="alert"><span>{storageError}</span>{teamConflict?<button className="field-button field-button-light" onClick={()=>{if(confirm('Odbaciti neposlate izmene ovog posla i preuzeti verziju iz baze?'))discardConflictingTeamChange();}}>Preuzmi verziju iz baze</button>:<button className="field-button field-button-light" onClick={retrySave}>Pokušaj ponovo</button>}{!teamMember&&<Link to="/podesavanja/podaci">Rezervna kopija</Link>}</div>}
  <Routes>
   <Route path="/" element={<Dashboard onNew={()=>newJob()}/>}/>
   <Route path="/tim" element={<TeamPage/>}/>
   <Route path="/poslovi" element={<Jobs onNew={()=>newJob()}/>}/>
   <Route path="/ponude" element={<Jobs offers onNew={()=>newJob()}/>}/>
   <Route path="/katalog" element={<Catalog onUse={newJob}/>}/>
   <Route path="/katalog/sobna-vrata" element={<PortaCatalog/>}/>
   <Route path="/podesavanja" element={<SettingsPage/>}/>
   <Route path="/podesavanja/:section" element={<SettingsPage/>}/>
   <Route path="/cenovnik" element={<SettingsPage forcedSection="cenovnik"/>}/>
   <Route path="/posao/:id" element={<Editor/>}/>
   <Route path="/posao/:id/dodaj" element={<MeasurementAccess><TypeChooser/></MeasurementAccess>}/>
   <Route path="/posao/:id/modeli" element={<MeasurementAccess><Catalog onUse={newJob}/></MeasurementAccess>}/>
   <Route path="/posao/:id/sobna-vrata" element={<MeasurementAccess><PortaCatalog/></MeasurementAccess>}/>
   <Route path="/posao/:id/nov/:type" element={<MeasurementAccess><PositionEditor key={location.pathname+location.search}/></MeasurementAccess>}/>
   <Route path="/posao/:id/element/:positionId" element={<MeasurementAccess><PositionEditor key={location.pathname+location.search}/></MeasurementAccess>}/>
   <Route path="/posao/:id/korekcija" element={<MeasurementAccess>{settings.showPrices===false?<Navigate to="../ponuda" relative="path" replace/>:<Correction/>}</MeasurementAccess>}/>
   <Route path="/posao/:id/ponuda" element={<MeasurementAccess><Quote/></MeasurementAccess>}/>
   <Route path="*" element={<Empty title="Stranica nije pronađena" action={<Link to="/" className="field-button field-button-yellow">Vrati se na početnu</Link>}/>}/>
  </Routes>
  {draft&&<NewJobDialog onClose={()=>setDraft(null)} onCreate={name=>{const job={...draft.job,customer:{...draft.job.customer,name},createdAt:new Date().toISOString()};const choice=draft.choice;addJob(job);setDraft(null);navigate(choice?catalogChoicePath(job.id,choice):`/posao/${job.id}/dodaj`);}}/>}
  {searchOpen&&<Modal title="Pronađite posao" onClose={()=>setSearchOpen(false)}><label className="search-field"><Search size={18}/><input autoFocus aria-label="Pretraži sve poslove" placeholder="Kupac, adresa ili broj posla…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="search-results">{jobs.filter(j=>`${j.id} ${j.customer.name} ${j.customer.address}`.toLowerCase().includes(search.toLowerCase())).map(j=><button key={j.id} onClick={()=>{navigate(`/posao/${j.id}`);setSearchOpen(false);}}><FolderOpen size={20}/><span><strong>{j.customer.name}</strong><small>{j.id} · {j.customer.address}</small></span><ArrowRight size={17}/></button>)}</div></Modal>}
  {notifications&&<Modal title="Obaveštenja" onClose={()=>setNotifications(false)}><Empty title="Nema obaveštenja"/></Modal>}
 </AppShell>;
}

function MeasurementAccess({children}:{children:ReactNode}){
 const {id}=useParams();
 const waiting=useStore(state=>state.jobs.some(job=>job.id===id&&awaitingMeasurements(state,job)));
 return waiting?<Navigate to={`/posao/${id}`} replace/>:children;
}

function PositionEditor(){
 const {type,id,positionId}=useParams(),[params]=useSearchParams();
 const position=useStore(s=>s.jobs.find(j=>j.id===id)?.positions.find(p=>p.id===positionId));
 const model=findCatalogModel(params.get('model'));
 if(position?.portaRoyal||type==='sobna-vrata')return <PortaEditor/>;
 if(!positionId&&(params.has('model')||type==='model')&&!model)return <Empty title="Model nije pronađen" action={<Link className="field-button field-button-yellow" to={`/posao/${id}/modeli`}>Otvori katalog</Link>}/>;
 return (model?model.shape:type==='nacrtaj'||position?.customGeometry)?<CustomEditor/>:<ElementEditor/>;
}
