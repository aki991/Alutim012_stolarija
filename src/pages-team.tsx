import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check, LogOut, MessageSquare, Send } from 'lucide-react';
import { FieldHeader } from './components/FieldHeader';
import { uid } from './catalog';
import { acceptTeamJob, jobFromSettings, useStore } from './store';
import type { Job } from './models';
import { assignTeamJob, createTeamJob, fetchTeamMessages, fetchTeamWorkers, sendTeamMessage, type TeamMember, type TeamMessage } from './services/team-api';
import { pollTeam, signOutTeam, useTeamInbox } from './team-session';

const dateTime = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Belgrade' });
const notificationLabels = { assignment: 'Dodeljeno merenje', status: 'Promena statusa' };

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

export function AccountPage() {
 const member = useStore(state => state.teamMember);
 const navigate = useNavigate();
 const [actionError, setActionError] = useState('');
 if (!member) return null;
 const manager = member.role === 'manager';

 return <div className="team-page">
  <FieldHeader title="Nalog" back="/"/>
  <main className="team-content">
   <div className="team-account">
    <div><strong>{member.name}</strong><small>{manager ? 'Šef' : 'Majstor'}</small></div>
    <button type="button" className="field-button field-button-light" onClick={() => {
     void signOutTeam().then(() => navigate('/prijava', { replace: true })).catch(() => setActionError('Odjava trenutno nije uspela.'));
    }}><LogOut size={18}/>Odjavi se</button>
   </div>
   {actionError && <p className="team-error" role="alert">{actionError}</p>}
  </main>
 </div>;
}

export function NotificationsPage() {
 const { items, error, markRead } = useTeamInbox();
 const [readError, setReadError] = useState('');
 function read(id: string) {
  setReadError('');
  void markRead(id).catch(() => setReadError('Označavanje obaveštenja nije uspelo. Pokušajte ponovo.'));
 }
 return <div className="team-page"><FieldHeader title="Obaveštenja" back="/"/>
  <main className="team-content">
   {(error || readError) && <p className="team-error" role="alert">{error || readError}</p>}
   {!error && !items.length && <p>Nema obaveštenja.</p>}
   <ul className="team-list">{items.map(item => <li key={item.id} className={`team-notice${item.read_at ? '' : ' unread'}`}>
    <Link to={`/posao/${item.job_id}`} onClick={() => { if (!item.read_at) read(item.id); }}>
     <small>{notificationLabels[item.kind]} · {dateTime.format(new Date(item.created_at))}{!item.read_at && ' · Novo'}</small>
     <strong>{item.job_name}</strong><span>{item.actor_name}{item.kind === 'status' && ` · ${item.body}`}</span>
    </Link>
    {!item.read_at && <button className="team-mark-read" type="button" onClick={() => read(item.id)}><Check size={16}/>Označi kao pročitano</button>}
   </li>)}</ul>
  </main>
 </div>;
}

export function AssignmentPage() {
 const { id } = useParams();
 const member = useStore(state => state.teamMember);
 const job = useStore(state => state.jobs.find(item => item.id === id));
 const assignedTo = useStore(state => id ? state.teamAssignments[id] : null);
 if (member?.role !== 'manager') return <Navigate to="/poslovi" replace/>;
 return <div className="team-page"><FieldHeader title="Dodeli merenje" back={job ? `/posao/${job.id}` : '/poslovi'}/>
  <main className="team-content">{id ? (job ? <ExistingAssignment key={id} job={job} member={member} assignedTo={assignedTo}/> : <p>Posao nije pronađen.</p>) : <NewAssignment member={member}/>}</main>
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

 return <section className="team-card">
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
 const manager = member.role === 'manager';
 const assignedTo = assignments[job.id];
 return <section className="team-card team-conversation" aria-label="Merenje i dodela">
  {job.status === 'Merenje' && (!manager || !assignedTo) && <div className="team-measure-action">
   <button type="button" className="field-button field-button-yellow" disabled={!job.positions.length} onClick={() => useStore.getState().updateJob(job.id, { status: 'Poslati ponudu' })}><Check size={19}/>Merenje završeno</button>
   {!job.positions.length && <small>Dodajte izmerene elemente pre završetka merenja.</small>}
  </div>}
  <div className="team-actions">
   {manager && <Link className="field-button field-button-light" to={`/dodeli-merenje/${job.id}`}>{assignedTo ? 'Promeni majstora' : 'Dodeli merenje'}</Link>}
   {(!manager || assignedTo) && <Link className="field-button field-button-light" to={`/poruke/${job.id}`}><MessageSquare size={18}/>Poruke o poslu</Link>}
  </div>
 </section>;
}

function ExistingAssignment({ job, member, assignedTo }: { job: Job; member: TeamMember; assignedTo: string | null }) {
 const { workers, error: workersError, retry } = useWorkers(true);
 const [assignee, setAssignee] = useState('');
 const [instructions, setInstructions] = useState('');
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const { refreshMessages } = useTeamInbox();
 const navigate = useNavigate();
 const id = job.id;

 async function assign(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!assignee || assignee === assignedTo || busy) return;
  setBusy(true);
  setError('');
  try {
   const row = await assignTeamJob(id, assignee, instructions.trim());
   acceptTeamJob(row, member.id);
   refreshMessages();
   navigate(`/posao/${id}`);
  } catch { setError('Dodela majstora trenutno nije potvrđena. Pokušajte ponovo.'); }
  finally { setBusy(false); }
 }

 return <section className="team-card">
   <h2>{job.customer.name}</h2>
   {assignedTo && <p className="team-current-worker">Trenutno dodeljeno: {workers.find(worker => worker.id === assignedTo)?.name ?? job.technician}</p>}
   {workersError && <p className="team-error" role="alert">{workersError} <button type="button" onClick={retry}>Učitaj ponovo</button></p>}
   <form className="team-form" onSubmit={assign}><fieldset disabled={busy}>
    <WorkerPicker workers={workers.filter(worker => worker.id !== assignedTo)} value={assignee} onChange={setAssignee}/>
    <label>Uputstvo za majstora<textarea value={instructions} onChange={event => setInstructions(event.target.value)} rows={2} maxLength={4000}/></label>
    <button className="field-button field-button-light" disabled={!assignee}>Potvrdi dodelu</button>
   </fieldset></form>
  {error && <p className="team-error" role="alert">{error}</p>}
 </section>;
}

export function MessagesPage() {
 const { id } = useParams();
 const { jobs, teamMember, teamAssignments } = useStore();
 const { conversations, messagesError, readMessages } = useTeamInbox();
 const [readError, setReadError] = useState('');
 const job = jobs.find(item => item.id === id);
 return <div className="team-page"><FieldHeader title={job ? `Poruke · ${job.customer.name}` : 'Poruke'} back={id ? '/poruke' : '/'}/>
  <main className="team-content">
   {id ? (job && teamMember ? <JobConversation key={job.id} job={job} member={teamMember} assignedTo={teamAssignments[job.id]}/> : <p>Razgovor nije dostupan.</p>) : <>
    {(messagesError || readError) && <p className="team-error" role="alert">{messagesError || readError}</p>}
    {!messagesError && !conversations.length && <p>Nema poruka.</p>}
    <ul className="team-list">{conversations.map(item => <li className={`team-notice${item.unread ? ' unread' : ''}`} key={item.job_id}>
     <Link to={`/poruke/${item.job_id}`}>
      <small>{dateTime.format(new Date(item.created_at))}{item.unread && ' · Novo'}</small>
      <strong>{item.job_name}</strong>
      <span>{item.sender_name} · {item.body}</span>
     </Link>
     {item.unread && <button className="team-mark-read" type="button" onClick={() => {
      setReadError('');
      void readMessages(item.job_id, item.id).catch(() => setReadError('Označavanje poruke nije uspelo. Pokušajte ponovo.'));
     }}><Check size={16}/>Označi kao pročitano</button>}
    </li>)}</ul>
   </>}
  </main>
 </div>;
}

function JobConversation({ job, member, assignedTo }: { job: Job; member: TeamMember; assignedTo?: string | null }) {
 const manager = member.role === 'manager';
 const { conversations, readMessages, refreshMessages } = useTeamInbox();
 const [messages, setMessages] = useState<TeamMessage[]>([]);
 const [message, setMessage] = useState('');
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [loadError, setLoadError] = useState('');
 const [reload, setReload] = useState(0);
 const messageId = useRef<string | null>(null);
 const lastMessageElement = useRef<HTMLLIElement>(null);
 const id = job.id;
 const latest = messages.at(-1);
 const unread = conversations.some(item => item.job_id === id && item.id === latest?.id && item.unread);
 useEffect(() => pollTeam(async isCurrent => {
  try {
   const next = await fetchTeamMessages(id);
   if (isCurrent()) { setMessages(next); setLoadError(''); }
  } catch { if (isCurrent()) setLoadError('Razgovor trenutno nije dostupan.'); }
 }), [id, reload]);

 useEffect(() => {
  const element = lastMessageElement.current;
  if (!element || !latest || !unread) return;
  let visible = false, reading = false;
  const markVisible = () => {
   if (!visible || reading || document.visibilityState !== 'visible') return;
   reading = true;
   void readMessages(id, latest.id).catch(() => { reading = false; });
  };
  const observer = new IntersectionObserver(([entry]) => {
   visible = entry.isIntersecting;
   markVisible();
  });
  observer.observe(element);
  document.addEventListener('visibilitychange', markVisible);
  window.addEventListener('focus', markVisible);
  window.addEventListener('online', markVisible);
  return () => {
   observer.disconnect();
   document.removeEventListener('visibilitychange', markVisible);
   window.removeEventListener('focus', markVisible);
   window.removeEventListener('online', markVisible);
  };
 }, [id, latest?.id, unread, readMessages]);

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
   refreshMessages();
  } catch { setError('Slanje poruke trenutno nije potvrđeno. Pokušajte ponovo.'); }
  finally { setBusy(false); }
 }

 return <section className="team-card" aria-label="Razgovor o poslu">
  <Link className="team-open-job" to={`/posao/${id}`}>Otvori posao</Link>
  {loadError && <p className="team-error" role="alert">{loadError}</p>}
  <ol className="team-list team-messages" aria-label="Poruke o poslu">{[...messages].reverse().map(item => <li ref={item.id === latest?.id ? lastMessageElement : undefined} className={item.sender_id === member.id ? 'mine' : ''} key={item.id}>
   <small><strong>{item.sender_name}</strong> · {dateTime.format(new Date(item.created_at))}</small><p>{item.body}</p>
  </li>)}</ol>
  {(!manager || assignedTo) && <form className="team-form" onSubmit={reply}>
   <label>{manager ? 'Poruka majstoru' : 'Poruka šefu'}<textarea value={message} disabled={busy} onChange={event => { messageId.current = null; setMessage(event.target.value); }} rows={2} required maxLength={4000}/></label>
   <button className="field-button field-button-light" disabled={busy || !message.trim()}><Send size={17}/>Pošalji poruku</button>
  </form>}
  {error && <p className="team-error" role="alert">{error}</p>}
 </section>;
}
