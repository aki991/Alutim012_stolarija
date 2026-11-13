import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, ClipboardList, LogOut, MessageSquare, Send } from 'lucide-react';
import { Badge } from './components/UI';
import { FieldHeader } from './components/FieldHeader';
import { uid } from './catalog';
import { acceptTeamJob, jobFromSettings, useStore } from './store';
import type { Job } from './models';
import { assignTeamJob, createTeamJob, fetchTeamMessages, fetchTeamWorkers, sendTeamMessage, type TeamMember, type TeamMessage } from './services/team-api';
import { pollTeam, signOutTeam, useTeamInbox } from './team-session';

const dateTime = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Belgrade' });
const notificationLabels = { assignment: 'Dodeljeno merenje', message: 'Poruka', status: 'Promena statusa' };

function useWorkers(enabled: boolean) {
 const [workers, setWorkers] = useState<TeamMember[]>([]);
 const [error, setError] = useState('');
 const [retry, setRetry] = useState(0);
 useEffect(() => {
  if (!enabled) return;
  let current = true;
  void fetchTeamWorkers().then(rows => {
   if (current) { setWorkers(rows); setError(''); }
  }).catch(() => { if (current) setError('Spisak majstora trenutno nije dostupan.'); });
  return () => { current = false; };
 }, [enabled, retry]);
 return { workers, error, retry: () => setRetry(value => value + 1) };
}

function WorkerPicker({ workers, value, onChange }: { workers: TeamMember[]; value: string; onChange: (value: string) => void }) {
 return <label>Majstor<select required value={value} onChange={event => onChange(event.target.value)}>
  <option value="">Izaberite majstora</option>
  {workers.map(worker => <option value={worker.id} key={worker.id}>{worker.name}</option>)}
 </select></label>;
}

export function TeamPage() {
 const member = useStore(state => state.teamMember);
 const jobs = useStore(state => state.jobs);
 const { items, error, markRead } = useTeamInbox();
 const navigate = useNavigate();
 const [actionError, setActionError] = useState('');
 if (!member) return null;
 const manager = member.role === 'manager';

 return <div className="team-page">
  <FieldHeader title="Tim i obaveštenja" back="/"/>
  <main className="team-content">
   <div className="team-account">
    <div><strong>{member.name}</strong><small>{manager ? 'Šef' : 'Majstor'}</small></div>
    <button type="button" className="field-button field-button-light" onClick={() => {
     void signOutTeam().then(() => navigate('/prijava', { replace: true })).catch(() => setActionError('Odjava trenutno nije uspela.'));
    }}><LogOut size={18}/>Odjavi se</button>
   </div>
   {actionError && <p className="team-error" role="alert">{actionError}</p>}
   <div className="team-grid">
    {manager ? <NewAssignment member={member}/> : <section className="team-card">
     <h2><ClipboardList size={21}/>Moji poslovi</h2>
     {jobs.length === 0 ? <p>Trenutno nemate dodeljenih poslova.</p> : <ul className="team-list">
      {jobs.map(job => <li key={job.id}><Link className="team-job-link" to={`/posao/${job.id}`}>
       <span><strong>{job.customer.name}</strong><small>{job.customer.address}</small></span><Badge status={job.status}/>
      </Link></li>)}
     </ul>}
    </section>}
    <section className="team-card" aria-labelledby="team-inbox-title">
     <h2 id="team-inbox-title"><Bell size={21}/>Obaveštenja</h2>
     {error && <p className="team-error" role="alert">{error}</p>}
     {!error && !items.length && <p>Nema obaveštenja.</p>}
     <ul className="team-list" aria-live="polite">{items.map(item => <li key={item.id} className={item.read_at ? 'team-notice' : 'team-notice unread'}>
      <Link to={`/posao/${item.job_id}`} onClick={() => { if (!item.read_at) void markRead(item.id).catch(() => {}); }}>
       <small>{notificationLabels[item.kind]} · {dateTime.format(new Date(item.created_at))}{!item.read_at && ' · Novo'}</small>
       <strong>{item.job_name}</strong><span>{item.actor_name} · {item.body}</span>
      </Link>
     </li>)}</ul>
    </section>
   </div>
  </main>
 </div>;
}

function NewAssignment({ member }: { member: TeamMember }) {
 const { workers, error: workersError, retry } = useWorkers(true);
 const [assignee, setAssignee] = useState('');
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const pending = useRef<{ key: string; job: Job } | null>(null);
 const navigate = useNavigate();

 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (busy) return;
  const form = new FormData(event.currentTarget);
  const value = (name: string) => String(form.get(name) ?? '').trim();
  const worker = workers.find(person => person.id === assignee);
  const customer = { name: value('name'), address: value('address'), phone: value('phone'), email: value('email'), building: value('building') };
  const date = value('date');
  const message = value('message');
  if (!worker || !customer.name || !customer.address || !message) {
   setError('Izaberite majstora i unesite naziv kupca, adresu i poruku.');
   return;
  }
  const key = JSON.stringify([assignee, customer, date, message]);
  if (pending.current?.key !== key) {
   const job = jobFromSettings(useStore.getState().settings);
   pending.current = { key, job: { ...job, date: date || job.date, technician: worker.name, customer, status: 'Merenje' } };
  }
  setBusy(true);
  setError('');
  try {
   const row = await createTeamJob(pending.current.job, worker.id, message);
   acceptTeamJob(row, member.id);
   navigate(`/posao/${row.id}`);
  } catch {
   setError('Dodela merenja trenutno nije potvrđena. Proverite vezu i pokušajte ponovo.');
  } finally { setBusy(false); }
 }

 return <section className="team-card"><h2><ClipboardList size={21}/>Dodeli merenje</h2>
  {workersError && <p className="team-error" role="alert">{workersError} <button type="button" onClick={retry}>Učitaj ponovo</button></p>}
  <form className="team-form" onSubmit={submit}>
   <fieldset disabled={busy}>
    <WorkerPicker workers={workers} value={assignee} onChange={setAssignee}/>
    <label>Naziv firme ili ime kupca<input name="name" required maxLength={100}/></label>
    <label>Adresa merenja<input name="address" required maxLength={250}/></label>
    <div className="team-form-columns">
     <label>Telefon<input name="phone" type="tel" maxLength={50}/></label>
     <label>E-adresa kupca<input name="email" type="email" maxLength={180}/></label>
    </div>
    <div className="team-form-columns">
     <label>Vrsta objekta<select name="building"><option value="">Nije navedeno</option><option>Porodična kuća</option><option>Stan</option><option>Poslovni prostor</option><option>Drugo</option></select></label>
     <label>Datum merenja<input name="date" type="date"/></label>
    </div>
    <label>Poruka majstoru<textarea name="message" required rows={3} maxLength={4000} placeholder="Šta treba izmeriti, termin i kako doći do objekta"/></label>
    {error && <p className="team-error" role="alert">{error}</p>}
    <button className="field-button field-button-red" disabled={!workers.length}><Send size={17}/>{busy ? 'Dodeljujem…' : 'Dodeli i pošalji'}</button>
   </fieldset>
  </form>
 </section>;
}

export function TeamJobPanel({ job }: { job: Job }) {
 const member = useStore(state => state.teamMember);
 const assignments = useStore(state => state.teamAssignments);
 if (!member || !Object.hasOwn(assignments, job.id)) return null;
 return <JobConversation key={job.id} job={job} member={member} assignedTo={assignments[job.id]}/>;
}

function JobConversation({ job, member, assignedTo }: { job: Job; member: TeamMember; assignedTo: string | null }) {
 const manager = member.role === 'manager';
 const { workers, error: workersError, retry } = useWorkers(manager);
 const [messages, setMessages] = useState<TeamMessage[]>([]);
 const [message, setMessage] = useState('');
 const [assignee, setAssignee] = useState('');
 const [instructions, setInstructions] = useState('');
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [loadError, setLoadError] = useState('');
 const [reload, setReload] = useState(0);
 const messageId = useRef<string | null>(null);
 const id = job.id;
 useEffect(() => pollTeam(async isCurrent => {
  try {
   const next = await fetchTeamMessages(id);
   if (isCurrent()) { setMessages(next); setLoadError(''); }
  } catch { if (isCurrent()) setLoadError('Razgovor trenutno nije dostupan.'); }
 }), [id, reload]);

 async function reply(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!message.trim() || busy) return;
  setBusy(true);
  setError('');
 messageId.current ??= uid();
  try {
   await sendTeamMessage(id, messageId.current, message.trim());
   setMessage('');
   messageId.current = null;
   setReload(n => n + 1);
  } catch { setError('Slanje poruke trenutno nije potvrđeno. Pokušajte ponovo.'); }
  finally { setBusy(false); }
 }

 async function assign(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!assignee || assignee === assignedTo || busy) return;
  setBusy(true);
  setError('');
  try {
   const row = await assignTeamJob(id, assignee, instructions.trim());
   acceptTeamJob(row, member.id);
   setAssignee('');
   setInstructions('');
   setReload(n => n + 1);
  } catch { setError('Dodela majstora trenutno nije potvrđena. Pokušajte ponovo.'); }
  finally { setBusy(false); }
 }

 return <section className="team-card team-conversation" aria-label="Komunikacija o poslu">
  <h2><MessageSquare size={21}/>Komunikacija o poslu</h2>
  {manager && <details><summary>{assignedTo ? `Dodeljeno: ${workers.find(worker => worker.id === assignedTo)?.name ?? job.technician}` : 'Dodeli majstora'}</summary>
   {workersError && <p className="team-error" role="alert">{workersError} <button type="button" onClick={retry}>Učitaj ponovo</button></p>}
   <form className="team-form" onSubmit={assign}><fieldset disabled={busy}>
    <WorkerPicker workers={workers.filter(worker => worker.id !== assignedTo)} value={assignee} onChange={setAssignee}/>
    <label>Uputstvo za majstora<textarea value={instructions} onChange={event => setInstructions(event.target.value)} rows={2} maxLength={4000}/></label>
    <button className="field-button field-button-light" disabled={!assignee}>Potvrdi dodelu</button>
   </fieldset></form>
  </details>}
  {job.status === 'Merenje' && (!manager || !assignedTo) && <div className="team-measure-action">
   <button type="button" className="field-button field-button-yellow" disabled={!job.positions.length} onClick={() => useStore.getState().updateJob(id, { status: 'Poslati ponudu' })}><Check size={19}/>Merenje završeno</button>
   {!job.positions.length && <small>Dodajte izmerene elemente pre završetka merenja.</small>}
  </div>}
  {loadError && <p className="team-error" role="alert">{loadError}</p>}
  {messages.length > 0 && <ol className="team-list team-messages" aria-label="Poruke o poslu">{messages.map(item => <li className={item.sender_id === member.id ? 'mine' : ''} key={item.id}>
   <small><strong>{item.sender_name}</strong> · {dateTime.format(new Date(item.created_at))}</small><p>{item.body}</p>
  </li>)}</ol>}
  {(!manager || assignedTo) && <form className="team-form" onSubmit={reply}>
   <label>{manager ? 'Poruka majstoru' : 'Poruka šefu'}<textarea value={message} disabled={busy} onChange={event => { messageId.current = null; setMessage(event.target.value); }} rows={2} required maxLength={4000}/></label>
   <button className="field-button field-button-light" disabled={busy || !message.trim()}><Send size={17}/>Pošalji poruku</button>
  </form>}
  {error && <p className="team-error" role="alert">{error}</p>}
 </section>;
}
