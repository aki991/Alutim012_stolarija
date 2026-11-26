import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, Plus, Search, Send, Trash2 } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { FieldHeader } from './components/FieldHeader';
import { PortaPhoto, PortaVariantOptions } from './components/PortaOptions';
import { Empty, Modal } from './components/UI';
import { AccountPage } from './pages-team';
import { catalog, makePosition } from './catalog';
import { portaConfiguration, portaDefaultSelection, portaPositionName, portaRoyalSeries, portaStartingSize, portaVariant, type PortaSelection } from './porta-royal';
import { acceptTeamJob, jobFromSettings, useStore } from './store';
import { createSalonRequest, fetchTeamAssignees, type TeamMember } from './services/team-api';
import type { Job, Position } from './models';
import './porta-royal.css';
import './salon.css';

export function SalonApp(){
 const navigate=useNavigate();
 const error=useStore(s=>s.storageError);
 return <AppShell onNew={()=>navigate('/katalog')} onSearch={()=>navigate('/poslovi')} onNotifications={()=>navigate('/poslovi')} onNavigation={()=>{}}>
  {error&&<p className="team-error" role="alert">{error}</p>}
  <Routes>
   <Route path="/" element={<SalonHome/>}/><Route path="/poslovi" element={<SalonJobs/>}/>
   <Route path="/katalog" element={<SalonRequest/>}/><Route path="/katalog/sobna-vrata" element={<SalonRequest/>}/>
   <Route path="/posao/:id" element={<SalonJob/>}/><Route path="/nalog" element={<AccountPage/>}/>
   <Route path="*" element={<Navigate to="/poslovi" replace/>}/>
  </Routes>
 </AppShell>;
}

function SalonHome(){
 const jobs=useStore(s=>s.jobs),member=useStore(s=>s.teamMember);
 return <div className="team-page salon-page"><FieldHeader title="Početna" back="/"/>
  <main className="team-content salon-home">
   <section className="team-card salon-home-welcome">
    <h2>Dobro došli, {member?.name}</h2>
    <p>Izaberite modele sobnih vrata i pošaljite zahtev za merenje šefu.</p>
    <div className="salon-home-actions">
     <Link className="field-button field-button-yellow" to="/katalog"><Plus aria-hidden="true"/>Novi zahtev</Link>
     <Link className="field-button field-button-light" to="/poslovi"><ClipboardList aria-hidden="true"/>Moji zahtevi</Link>
    </div>
   </section>
   <dl className="salon-home-stats" aria-label="Pregled zahteva">
    <div className="team-card"><dt>Ukupno zahteva</dt><dd>{jobs.length}</dd></div>
    <div className="team-card"><dt>Na merenju</dt><dd>{jobs.filter(job=>job.status==='Merenje').length}</dd></div>
   </dl>
  </main>
 </div>;
}

function SalonJobs(){
 const jobs=useStore(s=>s.jobs),member=useStore(s=>s.teamMember);
 const [search,setSearch]=useState('');
 const filtered=jobs.filter(job=>`${job.customer.name} ${job.customer.address} ${job.id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 return <div className="team-page salon-page"><FieldHeader title="Zahtevi salona" back="/"/>
  <main className="team-content"><div className="salon-heading"><div><h1>{member?.name}</h1><p>Izaberite sobna vrata i pošaljite zahtev za merenje šefu.</p></div><Link className="field-button field-button-yellow" to="/katalog"><Plus/>Novi zahtev</Link></div>
   <label className="jobs-search"><Search/><input aria-label="Pretraži zahteve" placeholder="Kupac ili adresa…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <ul className="team-list">{filtered.map(job=><li className="team-notice" key={job.id}><Link to={`/posao/${job.id}`}><small>{job.id} · {job.status}</small><strong>{job.customer.name}</strong><span>{job.customer.address}</span><span>{job.positions.length} modela · Šef: {job.salonRequest?.managerName||job.technician}</span></Link></li>)}</ul>
   {!filtered.length&&<Empty title={search?'Nema zahteva za ovu pretragu':'Još nema poslatih zahteva'}/>}
  </main></div>;
}

function SalonJob(){
 const {id}=useParams(),state=useStore(),job=state.jobs.find(item=>item.id===id);
 if(!job)return <Empty title="Zahtev nije pronađen"/>;
 const recipient=state.teamJobOrigins[job.id]?.assigned_to_name||job.technician;
 return <div className="team-page salon-page"><FieldHeader title={job.customer.name} back="/poslovi"/>
  <main className="team-content"><section className="team-card"><h1>{job.customer.name}</h1><p>{job.customer.address}</p><p>{job.customer.phone}</p><p>Status: <strong>{job.status}</strong></p><p>Poslato šefu: {job.salonRequest?.managerName}</p><p>Zadužen za merenje: {recipient}</p><p>{job.salonRequest?.instructions}</p>
   {job.measuredOn&&<p>Mereno: {job.measuredOn}</p>}{job.completionDeadline&&<p>Rok završetka: {job.completionDeadline}</p>}{job.completedOn&&<p>Završeno: {job.completedOn}</p>}{job.installedOn&&<p>Ugrađeno: {job.installedOn}</p>}
  </section><section className="salon-selected" aria-label="Izabrana vrata">{job.positions.map(p=><article className="team-card salon-door" key={p.id}>{p.portaRoyal&&<PortaPhoto selection={p.portaRoyal} size={p}/>}<div><h2>{p.name}</h2><p>{p.quantity} kom.</p>{p.measurementPending?<p>Čeka merenje</p>:<><p>Izmereno: {p.width} × {p.height} mm</p>{p.portaRoyal?.wall&&<p>Debljina zida: {p.portaRoyal.wall} mm</p>}</>}</div></article>)}</section>
  </main></div>;
}

function SalonRequest(){
 const member=useStore(s=>s.teamMember)!,navigate=useNavigate();
 const key=`alu-salon-request-v1:${member.id}`;
 const [positions,setPositions]=useState<Position[]>(()=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(p=>p&&p.portaRoyal&&portaVariant(p.portaRoyal)&&Number.isInteger(p.quantity)&&p.quantity>0&&p.quantity<=100):[];}catch{return [];}});
 const [draftError,setDraftError]=useState('');
 const [selection,setSelection]=useState<PortaSelection|null>(null),[search,setSearch]=useState('');
 const [people,setPeople]=useState<TeamMember[]>([]),[peopleError,setPeopleError]=useState(''),[reload,setReload]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef<{key:string;job:Job}|null>(null);
 useEffect(()=>{let current=true;void fetchTeamAssignees().then(rows=>{if(current){setPeople(rows.filter(p=>p.role==='manager'));setPeopleError('');}}).catch(()=>{if(current)setPeopleError('Spisak šefova nije dostupan.');});return()=>{current=false;};},[reload]);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(positions));setDraftError('');}catch{setDraftError('Izbor vrata nije sačuvan na uređaju. Ostavite stranicu otvorenu do slanja.');}},[key,positions]);
 function add(){
  if(!selection)return;
  const config=portaConfiguration(selection);
  const p:Position={...makePosition(catalog[7]),...portaStartingSize(selection.type),category:'Sobna vrata',elementType:'sobna-vrata',portaRoyal:config,name:portaPositionName(config),installation:false,measurementPending:true};
  setPositions(old=>[...old,p]);setSelection(null);
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!positions.length)return;
  const data=new FormData(e.currentTarget),value=(name:string)=>String(data.get(name)||'').trim();
  const recipient=people.find(person=>person.id===value('manager'));
  if(!recipient){setError('Izaberite šefa koji prima zahtev.');return;}
  const customer={name:value('name'),address:value('address'),phone:value('phone'),email:'',building:''},instructions=value('instructions');
  const signature=JSON.stringify([positions,customer,recipient.id,instructions]);
  if(pending.current?.key!==signature){const job=jobFromSettings(useStore.getState().settings);pending.current={key:signature,job:{...job,customer,positions,technician:recipient.name,notes:'',transport:0,siteCosts:undefined}};}
  setBusy(true);setError('');
  try{
   const row=await createSalonRequest(pending.current.job,recipient.id,instructions);
   acceptTeamJob(row,member.id);
   // Navigation unmounts this form before the draft-saving effect can run.
   try{localStorage.removeItem(key);}catch{ /* The request is already saved in the database. */ }
   setPositions([]);navigate(`/posao/${row.id}`);
  }
  catch(failure){setError(failure instanceof Error?failure.message:'Slanje nije uspelo. Pokušajte ponovo.');}
  finally{setBusy(false);}
 }
 const normalized=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
 const series=portaRoyalSeries.filter(s=>normalized(`${s.name} ${s.decors.map(d=>d.name).join(' ')}`).includes(normalized(search)));
 return <div className="team-page salon-page"><FieldHeader title="Novi zahtev za merenje" back="/poslovi"/><main className="salon-request-layout">
  <section><h1>Izaberite modele sobnih vrata</h1><p>Dimenzije unosi šef ili majstor nakon merenja.</p><label className="jobs-search"><Search/><input aria-label="Pretraži sobna vrata" placeholder="Serija ili dekor…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {positions.length>0&&<a className="salon-selection-jump field-button field-button-yellow" href="#salon-request-form">Izabrano modela: {positions.length} · Nastavi sa zahtevom</a>}
   <div className="porta-series-grid">{series.map(s=><button disabled={busy} className="porta-series-card" key={s.id} onClick={()=>setSelection(portaDefaultSelection(s))}><PortaPhoto selection={portaDefaultSelection(s)} lazy/><span><strong>{s.name}</strong><small>Izaberi dekor i tip vrata</small></span></button>)}</div>{!series.length&&<Empty title="Nema modela za ovu pretragu"/>}
  </section>
  <aside id="salon-request-form" className="team-card salon-request-form"><h2>Zahtev za merenje</h2><div className="salon-cart" aria-label="Izabrani modeli">{positions.map(p=><article key={p.id}><strong>{p.name}</strong><label>Količina<input type="number" min={1} max={100} step={1} value={p.quantity} disabled={busy} onChange={e=>{const quantity=Math.max(1,Math.min(100,Math.round(Number(e.target.value)||1)));setPositions(old=>old.map(item=>item.id===p.id?{...item,quantity}:item));}}/></label><button className="field-icon-button" aria-label={`Ukloni ${p.name}`} disabled={busy} onClick={()=>setPositions(old=>old.filter(item=>item.id!==p.id))}><Trash2/></button></article>)}</div>
   {!positions.length&&<p>Izaberite bar jedan model iz kataloga.</p>}{draftError&&<p role="alert">{draftError}</p>}
   {peopleError&&<p className="team-error" role="alert">{peopleError} <button onClick={()=>setReload(v=>v+1)}>Učitaj ponovo</button></p>}
   <form className="team-form" onSubmit={submit}><fieldset disabled={busy}><label>Šef<select name="manager" aria-label="Šef" required defaultValue=""><option value="">Izaberite šefa</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Ime kupca<input name="name" required maxLength={100}/></label><label>Adresa merenja<input name="address" required maxLength={250}/></label><label>Telefon kupca<input name="phone" type="tel" required maxLength={50}/></label><label>Uputstvo za merenje<textarea name="instructions" rows={3} maxLength={4000}/></label>{error&&<p className="team-error" role="alert">{error}</p>}<button className="field-button field-button-yellow" disabled={!positions.length||!people.length}><Send/>{busy?'Šaljem…':'Pošalji zahtev šefu'}</button></fieldset></form>
  </aside>
 </main>{selection&&<Modal title="Izaberite vrata" onClose={()=>setSelection(null)}><div className="salon-model-preview"><PortaPhoto selection={selection}/></div><PortaVariantOptions selection={selection} onChange={setSelection}/><div className="modal-footer"><button className="field-button field-button-yellow" onClick={add}><Plus/>Dodaj model u zahtev</button></div></Modal>}</div>;
}
