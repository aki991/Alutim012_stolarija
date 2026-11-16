import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RotateCcw, Trash2 } from 'lucide-react';
import { ModuleHeader } from './components/ModuleHeader';
import { Empty } from './components/UI';
import { fetchTeamTrash, restoreTeamJob, type TrashedTeamJob } from './services/team-api';
import { acceptTeamJob, useStore } from './store';

const dateTime = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Belgrade' });

export function TrashPage() {
 const member = useStore(state => state.teamMember);
 const localTrash = useStore(state => state.trash);
 const restoreLocalJob = useStore(state => state.restoreLocalJob);
 const [remoteTrash, setRemoteTrash] = useState<TrashedTeamJob[] | null>(null);
 const [loadError, setLoadError] = useState(false);
 const [retry, setRetry] = useState(0);
 const [restoring, setRestoring] = useState<string | null>(null);
 const [restoreError, setRestoreError] = useState('');
 const [message, setMessage] = useState('');
 const managerId = member?.role === 'manager' ? member.id : null;

 useEffect(() => {
  if (!managerId) return;
  let current = true;
  setLoadError(false);
  void fetchTeamTrash().then(rows => {
   if (current) setRemoteTrash(rows);
  }).catch(() => {
   if (current) setLoadError(true);
  });
  return () => { current = false; };
 }, [managerId, retry]);

 if (member?.role === 'worker') return <Navigate to="/poslovi" replace/>;
 const jobs = member ? remoteTrash : localTrash.map(({ job, deletedAt }) => ({
  id: job.id, name: job.customer.name, address: job.customer.address, deleted_at: deletedAt,
 }));

 async function restore(job: TrashedTeamJob) {
  if (restoring) return;
  setRestoring(job.id);
  setMessage('');
  setRestoreError('');
  try {
   if (managerId) {
    const restored = await restoreTeamJob(job);
    acceptTeamJob(restored, managerId);
    setRemoteTrash(rows => rows?.filter(row => row.id !== job.id) ?? null);
   } else restoreLocalJob(job.id);
   setMessage(`Posao „${job.name}“ je vraćen u poslove.`);
  } catch {
   setRestoreError('Vraćanje posla nije potvrđeno. Učitajte korpu ponovo ili pokušajte ponovo.');
  } finally { setRestoring(null); }
 }

 return <div className="module-page">
  <ModuleHeader title="Korpa" back="/poslovi" icon={Trash2}/>
  <main className="module-content"><section className="team-card" aria-label="Obrisani poslovi">
   {message && <p className="trash-feedback" role="status">{message}</p>}
   {(loadError || restoreError) && <div className="team-actions trash-feedback">
    <p className="team-error" role="alert">{loadError ? 'Korpa trenutno nije dostupna.' : restoreError}</p>
    <button className="field-button field-button-light" type="button" onClick={() => {
     setRestoreError('');
     setRetry(value => value + 1);
    }}>Učitaj ponovo</button>
   </div>}
   {jobs === null && !loadError && <p role="status">Učitavanje korpe…</p>}
   {jobs?.length === 0 && !loadError && <Empty title="Korpa je prazna"/>}
   {!!jobs?.length && <ul className="team-list" aria-label="Poslovi u korpi">{jobs.map(job => <li className="team-notice trash-job" key={job.id}>
    <div className="trash-job-details">
     <strong>{job.name}</strong>
     {job.address && <span>{job.address}</span>}
     <small>{job.id} · Obrisano {dateTime.format(new Date(job.deleted_at))}</small>
    </div>
    <button className="field-button field-button-light" type="button" aria-label={`Vrati posao ${job.name}`} disabled={restoring !== null} onClick={() => void restore(job)}>
     <RotateCcw size={18} aria-hidden="true"/>{restoring === job.id ? 'Vraćam…' : 'Vrati posao'}
    </button>
   </li>)}</ul>}
  </section></main>
 </div>;
}
