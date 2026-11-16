import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RotateCcw, Trash2 } from 'lucide-react';
import { ModuleHeader } from './components/ModuleHeader';
import { Empty, Modal } from './components/UI';
import { fetchTeamTrash, purgeTeamJobs, restoreTeamJob, type TrashedTeamJob } from './services/team-api';
import { acceptTeamJob, useStore } from './store';

const dateTime = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Belgrade' });

export function TrashPage() {
 const member = useStore(state => state.teamMember);
 const localTrash = useStore(state => state.trash);
 const restoreLocalJob = useStore(state => state.restoreLocalJob);
 const purgeLocalJobs = useStore(state => state.purgeLocalJobs);
 const [remoteTrash, setRemoteTrash] = useState<TrashedTeamJob[] | null>(null);
 const [loadError, setLoadError] = useState(false);
 const [retry, setRetry] = useState(0);
 const [restoring, setRestoring] = useState<string | null>(null);
 const [purging, setPurging] = useState(false);
 const [actionError, setActionError] = useState('');
 const [selected, setSelected] = useState<Set<string>>(() => new Set());
 const [confirmation, setConfirmation] = useState<TrashedTeamJob[] | null>(null);
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
  id: job.id, name: job.customer.name, address: job.customer.address, deleted_at: deletedAt, purge_started: false,
 }));
 const selectedJobs = jobs?.filter(job => selected.has(job.id)) ?? [];
 const multipleJobs = (jobs?.length ?? 0) > 1;
 const allSelected = selectedJobs.length === jobs?.length;
 const busy = restoring !== null || purging;

 function reload() {
  if (!managerId) return;
  setSelected(new Set());
  setRemoteTrash(null);
  setRetry(value => value + 1);
 }

 function removeFromList(ids: ReadonlySet<string>) {
  setRemoteTrash(rows => rows?.filter(row => !ids.has(row.id)) ?? null);
  setSelected(previous => new Set([...previous].filter(id => !ids.has(id))));
 }

 async function restore(job: TrashedTeamJob) {
  if (busy || job.purge_started) return;
  setRestoring(job.id);
  setMessage('');
  setActionError('');
  try {
   if (managerId) {
    const restored = await restoreTeamJob(job);
    acceptTeamJob(restored, managerId);
   } else restoreLocalJob(job.id);
   removeFromList(new Set([job.id]));
   setMessage(`Posao „${job.name}“ je vraćen u poslove.`);
  } catch {
   setActionError('Vraćanje posla nije potvrđeno. Pokušajte ponovo.');
   reload();
  } finally { setRestoring(null); }
 }

 async function purge(entries: TrashedTeamJob[]) {
  if (busy) return;
  setConfirmation(null);
  setPurging(true);
  setMessage('');
  setActionError('');
  const ids = new Set(entries.map(job => job.id));
  try {
   if (managerId) await purgeTeamJobs(entries);
   else purgeLocalJobs(ids);
   removeFromList(ids);
   setMessage(entries.length === 1 ? `Posao „${entries[0].name}“ je trajno obrisan.` : 'Označeni poslovi su trajno obrisani.');
  } catch {
   setActionError('Trajno brisanje nije završeno. Pokušajte ponovo.');
   reload();
  } finally { setPurging(false); }
 }

 return <div className="module-page">
  <ModuleHeader title="Korpa" back="/poslovi" icon={Trash2}/>
  <main className="module-content"><section className="team-card" aria-label="Obrisani poslovi">
   {(message || purging) && <p className="trash-feedback" role="status">{purging ? 'Trajno brisanje je u toku…' : message}</p>}
   {actionError && <p className="team-error" role="alert">{actionError}</p>}
   {loadError && <div className="team-actions trash-feedback">
    <p className="team-error" role="alert">Korpa trenutno nije dostupna.</p>
    <button className="field-button field-button-light" type="button" onClick={reload}>Učitaj ponovo</button>
   </div>}
   {jobs === null && !loadError && <p role="status">Učitavanje korpe…</p>}
   {jobs?.length === 0 && !loadError && <Empty title="Korpa je prazna"/>}
   {multipleJobs && <div className="trash-toolbar">
    <button className="field-button field-button-light" type="button" disabled={busy} onClick={() => setSelected(new Set(allSelected ? [] : jobs?.map(job => job.id)))}>
     {allSelected ? 'Poništi izbor' : 'Selektuj sve'}
    </button>
    <button className="field-button field-button-red" type="button" disabled={busy || !selectedJobs.length} onClick={() => setConfirmation(selectedJobs)}>
     {allSelected ? 'Trajno obriši sve' : 'Trajno obriši označene'}
    </button>
   </div>}
   {!!jobs?.length && <ul className="team-list" aria-label="Poslovi u korpi">{jobs.map(job => <li className="team-notice trash-job" key={job.id}>
    {multipleJobs && <label className="trash-job-select">
     <input type="checkbox" aria-label={`Označi posao ${job.name}`} disabled={busy} checked={selected.has(job.id)} onChange={event => {
      const checked = event.currentTarget.checked;
      setSelected(previous => {
       const next = new Set(previous);
       if (checked) next.add(job.id);
       else next.delete(job.id);
       return next;
      });
     }}/>
    </label>}
    <div className="trash-job-details">
     <strong>{job.name}</strong>
     {job.address && <span>{job.address}</span>}
     <small>{job.id} · Obrisano {dateTime.format(new Date(job.deleted_at))}</small>
    </div>
    <div className="trash-job-actions">
     <button className="field-button field-button-light" type="button" aria-label={`Vrati posao ${job.name}`} disabled={busy || job.purge_started} onClick={() => void restore(job)}>
      <RotateCcw size={18} aria-hidden="true"/>{restoring === job.id ? 'Vraćam…' : 'Vrati posao'}
     </button>
     <button className="field-button field-button-red" type="button" aria-label={`Trajno obriši posao ${job.name}`} disabled={busy} onClick={() => setConfirmation([job])}>
      <Trash2 size={18} aria-hidden="true"/>{job.purge_started ? 'Nastavi brisanje' : 'Trajno obriši'}
     </button>
    </div>
   </li>)}</ul>}
  </section></main>
  {confirmation && <Modal title="Trajno brisanje" onClose={() => setConfirmation(null)}>
   <p>{confirmation.length === 1 ? `Posao „${confirmation[0].name}“ biće trajno obrisan.` : `Broj poslova za trajno brisanje je ${confirmation.length}.`} Ovim se brišu i povezane mere, poruke i dokumenti.</p>
   <div className="modal-footer">
    <button className="field-button field-button-light" type="button" onClick={() => setConfirmation(null)}>Otkaži</button>
    <button className="field-button field-button-red" type="button" onClick={() => void purge(confirmation)}>Trajno obriši</button>
   </div>
  </Modal>}
 </div>;
}
