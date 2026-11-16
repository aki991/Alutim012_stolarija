import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CloudUpload, ExternalLink } from 'lucide-react';
import type { Job } from '../models';
import { findLocalJob, useStore } from '../store';
import { offlineJobTransferPath, transferredJobId, transferOfflineJob } from '../services/offline-job-transfer';
import { TeamRequestError } from '../services/team-api';
import { FieldHeader } from './FieldHeader';

export function OfflineJobTransferButton({ job, fromJobs = false }: { job: Job; fromJobs?: boolean }) {
 const navigate = useNavigate();
 const member = useStore(current => current.teamMember);
 const [error, setError] = useState('');
 const teamJobId = transferredJobId(job);
 function openTeam() {
  if (!navigator.onLine) {
   setError('Povežite se na internet za pristup timu.');
   return;
  }
  const destination = teamJobId ? `/posao/${encodeURIComponent(teamJobId)}` : offlineJobTransferPath;
  if (member) navigate(destination, { state: { localJobId: job.id, fromJobs } });
  else navigate('/prijava', { state: { from: destination, localJobId: job.id } });
 }
 return <div className="offline-job-transfer">
  <button type="button" className={`field-button ${fromJobs ? 'field-button-yellow' : 'field-button-light'}`} onClick={openTeam} disabled={!teamJobId && !job.positions.length}>
   {teamJobId ? <ExternalLink size={18} aria-hidden="true"/> : <CloudUpload size={18} aria-hidden="true"/>}
   {teamJobId ? 'Otvori u timu' : 'Dodaj u bazu'}
  </button>
  {error && <p className="field-error" role="alert">{error}</p>}
 </div>;
}

export function OfflineJobTransferPage() {
 const navigate = useNavigate();
 const { state } = useLocation();
 const member = useStore(current => current.teamMember);
 const job = typeof state?.localJobId === 'string' ? findLocalJob(state.localJobId) : undefined;
 const fromJobs = state?.fromJobs === true;
 const [error, setError] = useState('');
 const [attempt, setAttempt] = useState(0);
 useEffect(() => {
  if (!job || !member) return;
  let active = true;
  transferOfflineJob(job, member).then(id => {
   if (active) navigate(`/posao/${encodeURIComponent(id)}`, { replace: true, state: { offlineJobTransferred: true } });
  }).catch(failure => {
   if (!active) return;
   const rejected = failure instanceof TeamRequestError && ['23505', '42501', '22023', '40001'].includes(failure.code ?? '');
   setError(rejected ? failure.message : 'Prenos nije potvrđen. Proverite vezu i pokušajte ponovo.');
  });
  return () => { active = false; };
 }, [attempt, job, member, navigate]);

 return <div className="team-page">
  <FieldHeader title="Prebaci posao u tim" back="/poslovi"/>
  <main className="team-content"><section className="team-card">
   {job ? <>
    <h2>{job.customer.name}</h2>
    {error ? <><p className="field-error" role="alert">{error}</p><p>Lokalna kopija je i dalje na ovom uređaju.</p></>
     : <p role="status">Prebacujem posao u tim…</p>}
   </> : <p className="field-error" role="alert">Lokalni posao nije dostupan na ovom uređaju.</p>}
   {(error || !job) && <div className="team-actions">
    {job && <button className="field-button field-button-red" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Pokušaj ponovo</button>}
    <Link to={fromJobs ? '/poslovi' : '/radi-bez-interneta'} state={{ localJobId: job?.id }} replace className="field-button field-button-light">
     {fromJobs ? 'Vrati se na poslove' : job ? 'Vrati se na lokalni posao' : 'Otvori lokalne poslove'}
    </Link>
   </div>}
  </section></main>
 </div>;
}
