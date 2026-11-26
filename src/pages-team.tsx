import { JobAssignmentInfo } from './components/JobAssignmentInfo';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check, KeyRound, LogOut, MessageSquare, Send } from 'lucide-react';
import { FieldHeader } from './components/FieldHeader';
import { DeviceNotifications } from './components/DeviceNotifications';
import { ChangePassword } from './components/ChangePassword';
import { uid } from './catalog';
import { acceptTeamJob, canEditJob, canReassignJob, jobFromSettings, useStore } from './store';
import type { Job } from './models';
import { scheduledMeasurementDate, todayInBelgrade, useBelgradeToday } from './services/measurement-schedule';
import { assignTeamJob, createTeamJob, fetchTeamAssignees, fetchTeamMessages, sendTeamMessage, TeamRequestError, type TeamMember, type TeamMessage } from './services/team-api';
import { pollTeam, signOutTeam, teamNotificationLabels, useTeamInbox } from './team-session';

const dateTime = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Belgrade' });
const assignmentDateError = 'Datum merenja mora biti današnji ili budući.';

function AssignmentDateInput({ defaultValue, onPastDate }: { defaultValue?: string; onPastDate: () => void }) {
 const today = useBelgradeToday();
 return <label>Datum merenja<input name="date" type="date" min={today} defaultValue={defaultValue}
  required={defaultValue !== undefined} onInvalid={event => { if (event.currentTarget.validity.rangeUnderflow) onPastDate(); }}/></label>;
}

function useAssignees() {
 const [assignees, setAssignees] = useState<TeamMember[]>([]);
 const [error, setError] = useState('');
 const [retry, setRetry] = useState(0);
 useEffect(() => {
  let current = true;
  void fetchTeamAssignees().then(rows => {
   if (current) { setAssignees(rows); setError(''); }
  }).catch(() => { if (current) setError('Spisak zaposlenih trenutno nije dostupan.'); });
  return () => { current = false; };
 }, [retry]);
 return { assignees, error, retry: () => setRetry(value => value + 1) };
}

function AssigneePicker({ assignees, value, onChange }: { assignees: TeamMember[]; value: string; onChange: (value: string) => void }) {
 return <label>Zadužena osoba<select aria-label="Zadužena osoba" required value={value} onChange={event => onChange(event.target.value)}>
  <option value="">Izaberite osobu</option>
  {([['worker', 'Majstori'], ['manager', 'Šefovi']] as const).map(([role, label]) => {
   const people = assignees.filter(person => person.role === role);
   return people.length > 0 && <optgroup key={role} label={label}>
    {people.map(person => <option value={person.id} key={person.id}>{person.name}</option>)}
   </optgroup>;
  })}
 </select></label>;
}

export function AccountPage() {
 const member = useStore(state => state.teamMember);
 const navigate = useNavigate();
 const [actionError, setActionError] = useState('');
 const [changingPassword, setChangingPassword] = useState(false);
 const [passwordChanged, setPasswordChanged] = useState(false);
 if (!member) return null;

 return <div className="team-page">
  <FieldHeader title="Nalog" back="/"/>
  <main className="team-content">
   <div className="team-account">
    <div><strong>{member.name}</strong><small>{member.is_admin ? 'Admin' : member.role === 'manager' ? 'Šef' : member.role === 'salon' ? 'Salon' : 'Majstor'}</small></div>
    <div className="team-actions">
     <button type="button" className="field-button field-button-light" onClick={() => { setPasswordChanged(false); setChangingPassword(true); }}>
      <KeyRound size={18} aria-hidden="true"/>Promeni lozinku
     </button>
     <button type="button" className="field-button field-button-light" onClick={() => {
      void signOutTeam().then(() => navigate('/prijava', { replace: true })).catch(() => setActionError('Odjava trenutno nije uspela.'));
     }}><LogOut size={18}/>Odjavi se</button>
    </div>
   </div>
   {actionError && <p className="team-error" role="alert">{actionError}</p>}
   {passwordChanged && <p className="field-message" role="status">Lozinka je promenjena.</p>}
   <DeviceNotifications/>
  </main>
  {changingPassword && <ChangePassword memberId={member.id} onClose={() => setChangingPassword(false)} onSaved={() => {
   setChangingPassword(false);
   setPasswordChanged(true);
  }}/>}
 </div>;
}

export function NotificationsPage() {
 const { items, messageAlerts, error, markRead, readMessages } = useTeamInbox();
 const [readError, setReadError] = useState('');
 function read(action: () => Promise<void>) {
  setReadError('');
  void action().catch(() => setReadError('Označavanje kao pročitano nije uspelo. Pokušajte ponovo.'));
 }
 const notices = [...items.map(item => ({ ...item, path: `/posao/${item.job_id}`, label: teamNotificationLabels[item.kind],
  mark: () => markRead(item.id) })), ...messageAlerts.map(message => ({
  id: message.id, job_id: message.job_id, kind: 'message', actor_name: message.sender_name, job_name: message.job_name,
  body: '', created_at: message.created_at, read_at: null, path: `/poruke/${message.job_id}`, label: 'Nova poruka',
  mark: () => readMessages(message.job_id, message.id),
 }))].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
 return <div className="team-page"><FieldHeader title="Obaveštenja" back="/"/>
  <main className="team-content">
   {(error || readError) && <p className="team-error" role="alert">{error || readError}</p>}
   {!error && !notices.length && <p>Nema obaveštenja.</p>}
   <ul className="team-list">{notices.map(item => <li key={item.id} className={`team-notice${item.read_at ? '' : ' unread'}`}>
    <Link to={item.path} onClick={() => { if (!item.read_at && item.kind !== 'message') read(item.mark); }}>
     <small>{item.label} · {dateTime.format(new Date(item.created_at))}{!item.read_at && ' · Novo'}</small>
     <strong>{item.job_name}</strong><span>{item.actor_name}{item.body && ` · ${item.body}`}</span>
    </Link>
    {item.kind === 'assignment' && <Link className="team-mark-read" to={`/poruke/${item.job_id}`} onClick={() => { if (!item.read_at) read(item.mark); }}>
     <MessageSquare size={16}/>Otvori razgovor
    </Link>}
    {!item.read_at && <button className="team-mark-read" type="button" onClick={() => read(item.mark)}><Check size={16}/>Označi kao pročitano</button>}
   </li>)}</ul>
   <DeviceNotifications compact/>
  </main>
 </div>;
}

export function AssignmentPage() {
 const { id } = useParams();
 const canChange=useStore(state=>id?canReassignJob(state,id):true);
 const member = useStore(state => state.teamMember);
 const job = useStore(state => state.jobs.find(item => item.id === id));
 const assignedTo = useStore(state => id ? state.teamAssignments[id] : null);
 const assigneeOnly = useStore(state => id ? state.teamAssigneeOnly[id] : undefined);
 if (member?.role !== 'manager') return <Navigate to="/poslovi" replace/>;
 return <div className="team-page"><FieldHeader title="Dodeli merenje" back={job ? `/posao/${job.id}` : '/poslovi'}/>
  <main className="team-content">{id ? (job ? !canChange?<section className="team-card"><JobAssignmentInfo job={job}/><p role="status">Dodelu merenja može da promeni samo osoba koja je poslala zahtev.</p></section>:<ExistingAssignment key={id} job={job} member={member} assignedTo={assignedTo} assigneeOnly={assigneeOnly}/> : <p>Posao nije pronađen.</p>) : <NewAssignment member={member}/>}</main>
 </div>;
}

function JobVisibility({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
 return <label className="team-job-visibility">
  <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/>
  <span>Prikaži posao samo zaduženoj osobi i šefovima</span>
 </label>;
}

function NewAssignment({ member }: { member: TeamMember }) {
 const { assignees, error: assigneesError, retry } = useAssignees();
 const candidates = assignees.filter(person => person.id !== member.id&&person.role!=='salon');
 const [assignee, setAssignee] = useState('');
 const [assigneeOnly, setAssigneeOnly] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const pending = useRef<{ key: string; job: Job } | null>(null);
 const navigate = useNavigate();

 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (busy) return;
  const form = new FormData(event.currentTarget);
  const value = (name: string) => String(form.get(name) ?? '').trim();
  const recipient = candidates.find(person => person.id === assignee);
  const customer = { name: value('name'), address: value('address'), phone: value('phone'), email: value('email'), building: value('building') };
  const today = todayInBelgrade();
  const date = value('date') || today;
  const message = value('message');
  if (!recipient || !customer.name || !customer.address || !message) {
   setError('Izaberite zaduženu osobu i unesite naziv kupca, adresu i uputstvo.');
   return;
  }
  if (date < today) { setError(assignmentDateError); return; }
  const key = JSON.stringify([assignee, customer, date, message, assigneeOnly]);
  if (pending.current?.key !== key) {
   const job = jobFromSettings(useStore.getState().settings);
   pending.current = { key, job: { ...job, date, technician: recipient.name, customer, status: 'Merenje' } };
  }
  setBusy(true);
  setError('');
  try {
   const row = await createTeamJob(pending.current.job, recipient.id, message, assigneeOnly);
   acceptTeamJob(row, member.id);
   navigate(`/posao/${row.id}`);
  } catch (error) {
   setError(error instanceof TeamRequestError && error.code === '22007' ? assignmentDateError
    : 'Dodela merenja trenutno nije potvrđena. Proverite vezu i pokušajte ponovo.');
  } finally { setBusy(false); }
 }

 return <section className="team-card">
  {assigneesError && <p className="team-error" role="alert">{assigneesError} <button type="button" onClick={retry}>Učitaj ponovo</button></p>}
  <form className="team-form" onSubmit={submit}>
   <fieldset disabled={busy}>
    <AssigneePicker assignees={candidates} value={assignee} onChange={setAssignee}/>
    <JobVisibility checked={assigneeOnly} onChange={setAssigneeOnly}/>
    <label>Naziv firme ili ime kupca<input name="name" required maxLength={100}/></label>
    <label>Adresa merenja<input name="address" required maxLength={250}/></label>
    <div className="team-form-columns">
     <label>Telefon<input name="phone" type="tel" maxLength={50}/></label>
     <label>E-adresa kupca<input name="email" type="email" maxLength={180}/></label>
    </div>
    <div className="team-form-columns">
     <label>Vrsta objekta<select name="building"><option value="">Nije navedeno</option><option>Porodična kuća</option><option>Stan</option><option>Poslovni prostor</option><option>Drugo</option></select></label>
     <AssignmentDateInput onPastDate={() => setError(assignmentDateError)}/>
    </div>
    <label>Uputstvo za merenje<textarea name="message" required rows={3} maxLength={4000} placeholder="Šta treba izmeriti, termin i kako doći do objekta"/></label>
    {error && <p className="team-error" role="alert">{error}</p>}
    <button className="field-button field-button-red" disabled={!candidates.length}><Send size={17}/>{busy ? 'Dodeljujem…' : 'Dodeli i pošalji'}</button>
   </fieldset>
  </form>
 </section>;
}

export function TeamJobPanel({ job }: { job: Job }) {
 const member = useStore(state => state.teamMember);
 const assignments = useStore(state => state.teamAssignments);
 const assigneeOnly = useStore(state => state.teamAssigneeOnly[job.id]);
 const editable = useStore(state => canEditJob(state,job));
 const canChange=useStore(state=>canReassignJob(state,job.id));
 if (!member || (!editable&&member.role!=='manager') || !Object.hasOwn(assignments, job.id)) return null;
 const manager = member.role === 'manager';
 const assignedTo = assignments[job.id];
 return <section className="team-card team-conversation" aria-label="Merenje i dodela">
  {manager && assignedTo && <p className="team-current-worker">Vidljivost posla · {assigneeOnly ? 'Zadužena osoba i šefovi' : 'Ceo tim'}</p>}
  <div className="team-actions">
   {manager && canChange && <Link className="field-button field-button-light" to={`/dodeli-merenje/${job.id}`}>{job.salonRequest?'Prosledi majstoru':assignedTo ? 'Dodela i vidljivost' : 'Dodeli merenje'}</Link>}
   {(!manager || assignedTo) && <Link className="field-button field-button-light" to={`/poruke/${job.id}`}><MessageSquare size={18}/>Poruke o poslu</Link>}
  </div>
 </section>;
}

function ExistingAssignment({ job, member, assignedTo, assigneeOnly }: { job: Job; member: TeamMember; assignedTo: string | null; assigneeOnly?: boolean }) {
 const { assignees, error: assigneesError, retry } = useAssignees();
 const candidates = assignees.filter(person=>person.role!=='salon'&&(!job.salonRequest||person.role==='worker'||person.id===member.id));
 const [selectedAssignee, setAssignee] = useState<string | null>(null);
 const [selectedVisibility, setRestricted] = useState<boolean | null>(null);
 const [instructions, setInstructions] = useState('');
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const { refreshMessages } = useTeamInbox();
 const navigate = useNavigate();
 const id = job.id;
 const assignee = selectedAssignee ?? assignedTo ?? '';
 const currentVisibility = Boolean(assignedTo && assigneeOnly);
 const restricted = selectedVisibility ?? currentVisibility;
 const reassigning = assignee !== assignedTo;
 const hasChange = Boolean(assignee) && (reassigning || restricted !== currentVisibility);
 const today = useBelgradeToday();
 const dateForAssignment = scheduledMeasurementDate(job, Boolean(assignedTo), today);
 const defaultDate = dateForAssignment >= today ? dateForAssignment : '';

 async function assign(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!hasChange || busy) return;
  const date = reassigning ? String(new FormData(event.currentTarget).get('date') ?? '') : undefined;
  if (date !== undefined && date < todayInBelgrade()) { setError(assignmentDateError); return; }
  setBusy(true);
  setError('');
  try {
   const row = await assignTeamJob(id, assignee, reassigning ? instructions.trim() : '', restricted, date);
   acceptTeamJob(row, member.id);
   refreshMessages();
   navigate(`/posao/${id}`);
  } catch (error) {
   setError(error instanceof TeamRequestError && error.code === '22007' ? assignmentDateError
    : error instanceof TeamRequestError&&error.code==='42501'?error.message:'Dodela merenja trenutno nije potvrđena. Pokušajte ponovo.');
  }
  finally { setBusy(false); }
 }

 return <section className="team-card">
   <h2>{job.customer.name}</h2>
   {assignedTo && <p className="team-current-worker">Trenutno dodeljeno: {assignees.find(person => person.id === assignedTo)?.name ?? job.technician}</p>}
   {assigneesError && <p className="team-error" role="alert">{assigneesError} <button type="button" onClick={retry}>Učitaj ponovo</button></p>}
   <form className="team-form" onSubmit={assign}><fieldset disabled={busy}>
    <AssigneePicker assignees={candidates} value={assignee} onChange={setAssignee}/>
    {!job.salonRequest&&<JobVisibility checked={restricted} onChange={setRestricted}/>}
    {reassigning && <>
     <AssignmentDateInput defaultValue={defaultDate} onPastDate={() => setError(assignmentDateError)}/>
     <label>Uputstvo za merenje<textarea value={instructions} onChange={event => setInstructions(event.target.value)} rows={2} maxLength={4000}/></label>
    </>}
    <button className="field-button field-button-light" disabled={!hasChange}>{reassigning ? 'Potvrdi dodelu' : 'Sačuvaj vidljivost'}</button>
   </fieldset></form>
  {error && <p className="team-error" role="alert">{error}</p>}
 </section>;
}

export function MessagesPage() {
 const { id } = useParams();
 const state = useStore();
 const { jobs, teamMember, teamAssignments } = state;
 const { conversations, messagesError, readMessages } = useTeamInbox();
 const [readError, setReadError] = useState('');
 const job = jobs.find(item => item.id === id);
 return <div className="team-page"><FieldHeader title={job ? `Poruke · ${job.customer.name}` : 'Poruke'} back={id ? '/poruke' : '/'}/>
  <main className="team-content">
   {id ? (job && teamMember && canEditJob(state,job) ? <JobConversation key={job.id} job={job} member={teamMember} assignedTo={teamAssignments[job.id]}/> : <p>Razgovor nije dostupan.</p>) : <>
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
 const messageList = useRef<HTMLOListElement>(null);
 const followNewest = useRef(true);
 const lastMessageElement = useRef<HTMLLIElement>(null);
 const id = job.id;
 const latest = messages.at(-1);
 const unread = conversations.some(item => item.job_id === id && item.id === latest?.id && item.unread);
 useEffect(() => pollTeam(async isCurrent => {
  try {
   const next = await fetchTeamMessages(id);
   if (isCurrent()) {
    const list = messageList.current;
    followNewest.current = !list || list.scrollHeight - list.clientHeight - list.scrollTop <= 32;
    setMessages(next);
    setLoadError('');
   }
  } catch { if (isCurrent()) setLoadError('Razgovor trenutno nije dostupan.'); }
 }), [id, reload]);

 useLayoutEffect(() => {
  const list = messageList.current;
  if (list && followNewest.current) list.scrollTop = list.scrollHeight;
 }, [latest?.id]);

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
   followNewest.current = true;
   const list = messageList.current;
   if (list) list.scrollTop = list.scrollHeight;
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
  <ol className="team-list team-messages" ref={messageList} aria-label="Poruke o poslu" tabIndex={0}>{messages.map(item => <li ref={item.id === latest?.id ? lastMessageElement : undefined} className={item.sender_id === member.id ? 'mine' : ''} key={item.id}>
   <small><strong>{item.sender_name}</strong> · {dateTime.format(new Date(item.created_at))}</small><p>{item.body}</p>
  </li>)}</ol>
  {(!manager || assignedTo) && <form className="team-form" onSubmit={reply}>
   <label>Poruka<textarea value={message} disabled={busy} onChange={event => { messageId.current = null; setMessage(event.target.value); }} rows={2} required maxLength={4000}/></label>
   <button className="field-button field-button-light" disabled={busy || !message.trim()}><Send size={17}/>Pošalji poruku</button>
  </form>}
  {error && <p className="team-error" role="alert">{error}</p>}
 </section>;
}
