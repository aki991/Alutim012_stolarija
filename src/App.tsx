import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ClipboardList, FolderOpen, Search } from 'lucide-react';
import { emptyJob, useStore } from './store';
import type { Job } from './models';
import { Empty, Modal } from './components/UI';
import { NewJobDialog } from './components/NewJobDialog';
import { AppShell } from './components/AppShell';
import { Dashboard } from './pages-dashboard';
import { Catalog, Jobs, type CatalogChoice } from './pages-lists';
import { SettingsPage } from './pages-settings';
import { Editor, TypeChooser, ElementEditor } from './pages-editor';
import { CustomEditor } from './custom/CustomEditor';
import { Quote } from './pages-quote';

export default function App(){
 const {jobs,settings,addJob,storageError,retrySave}=useStore(),navigate=useNavigate(),location=useLocation();
 const [draft,setDraft]=useState<{job:Job;choice?:CatalogChoice}|null>(null),[searchOpen,setSearchOpen]=useState(false),[search,setSearch]=useState(''),[notifications,setNotifications]=useState(false);
 const newJob=(choice?:CatalogChoice)=>{const job=emptyJob(settings.technician);job.transport=settings.prices.transport;if(settings.documentDefaults){job.validity=settings.documentDefaults.validity;job.delivery=settings.documentDefaults.delivery;job.payment=settings.documentDefaults.payment;}setDraft({job,choice});};
 const pending=jobs.filter(j=>j.status==='Čeka proveru');
 useEffect(()=>{setDraft(null);setSearchOpen(false);setNotifications(false);},[location.pathname]);
 return <AppShell onNavigation={()=>{setDraft(null);setSearchOpen(false);setNotifications(false);}} onNew={()=>newJob()} onSearch={()=>setSearchOpen(true)} onNotifications={()=>setNotifications(true)}>
  {storageError&&<div className="storage-error" role="alert"><span>{storageError}</span><button className="field-button field-button-light" onClick={retrySave}>Pokušaj ponovo</button><Link to="/podesavanja/podaci">Rezervna kopija</Link></div>}
  <Routes>
   <Route path="/" element={<Dashboard onNew={()=>newJob()}/>}/>
   <Route path="/poslovi" element={<Jobs onNew={()=>newJob()}/>}/>
   <Route path="/ponude" element={<Jobs offers onNew={()=>newJob()}/>}/>
   <Route path="/katalog" element={<Catalog onUse={newJob}/>}/>
   <Route path="/podesavanja" element={<SettingsPage/>}/>
   <Route path="/podesavanja/:section" element={<SettingsPage/>}/>
   <Route path="/cenovnik" element={<SettingsPage forcedSection="cenovnik"/>}/>
   <Route path="/posao/:id" element={<Editor/>}/>
   <Route path="/posao/:id/dodaj" element={<TypeChooser/>}/>
   <Route path="/posao/:id/nov/:type" element={<PositionEditor key={location.pathname+location.search}/>}/>
   <Route path="/posao/:id/element/:positionId" element={<PositionEditor key={location.pathname+location.search}/>}/>
   <Route path="/posao/:id/ponuda" element={<Quote/>}/>
   <Route path="*" element={<Empty title="Stranica nije pronađena" action={<Link to="/" className="field-button field-button-yellow">Vrati se na početnu</Link>}/>}/>
  </Routes>
  {draft&&<NewJobDialog onClose={()=>setDraft(null)} onCreate={name=>{const job={...draft.job,customer:{...draft.job.customer,name},createdAt:new Date().toISOString()};const choice=draft.choice;addJob(job);setDraft(null);navigate(choice?`/posao/${job.id}/nov/${choice.type}${choice.template===undefined?'':`?template=${choice.template}`}`:`/posao/${job.id}/dodaj`);}}/>}
  {searchOpen&&<Modal title="Pronađite posao" onClose={()=>setSearchOpen(false)}><label className="search-field"><Search size={18}/><input autoFocus aria-label="Pretraži sve poslove" placeholder="Kupac, adresa ili broj posla…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="search-results">{jobs.filter(j=>`${j.id} ${j.customer.name} ${j.customer.address}`.toLowerCase().includes(search.toLowerCase())).map(j=><button key={j.id} onClick={()=>{navigate(`/posao/${j.id}`);setSearchOpen(false);}}><FolderOpen size={20}/><span><strong>{j.customer.name}</strong><small>{j.id} · {j.customer.address}</small></span><ArrowRight size={17}/></button>)}</div></Modal>}
  {notifications&&<Modal title="Za tehničku proveru" onClose={()=>setNotifications(false)}><p className="muted">Poslovi označeni za kancelariju. Dokumenti nisu automatski poslati.</p><div className="search-results">{pending.map(j=><button key={j.id} onClick={()=>{navigate(`/posao/${j.id}/ponuda`);setNotifications(false);}}><ClipboardList size={22}/><span><strong>{j.customer.name}</strong><small>{j.id}</small></span><ArrowRight size={17}/></button>)}</div>{!pending.length&&<Empty title="Nema poslova za proveru"/>}</Modal>}
 </AppShell>;
}

function PositionEditor(){const {type,id,positionId}=useParams();const position=useStore(s=>s.jobs.find(j=>j.id===id)?.positions.find(p=>p.id===positionId));return type==='nacrtaj'||position?.customGeometry?<CustomEditor/>:<ElementEditor/>;}
