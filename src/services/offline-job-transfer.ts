import { todayInBelgrade } from './measurement-schedule';
import type { Job } from '../models';
import { acceptTeamJob, useStore, withPositionPrice, workerJobPricing } from '../store';
import { createTeamJob, TeamRequestError, updateTeamJob, type TeamMember } from './team-api';

export const offlineJobTransferPath = '/prebaci-u-tim';
const teamIdPattern = /^AT-[A-Za-z0-9-]{1,80}$/;
type TransferredJob = Job & { offlineSource?: string };
const sourceOf = (job: Job) => JSON.stringify([job.id, job.createdAt || job.updated]);
const receiptKey = (job: Job) => 'alu-team-transfer-v1:' + sourceOf(job);
const inFlight = new Map<string, Promise<string>>();

export function transferredJobId(job: Job): string | null {
 try {
  const value = localStorage.getItem(receiptKey(job));
  return value && teamIdPattern.test(value) ? value : null;
 } catch { return null; }
}

export function unsentLocalJobs(localJobs: Job[], teamJobs: TransferredJob[]): Job[] {
 const sent = new Set(teamJobs.filter(job => job.status !== 'Merenje').map(job => job.offlineSource));
 return localJobs.filter(job => !transferredJobId(job) && !sent.has(sourceOf(job)));
}

export function isUnfinishedLocalTransfer(job: TransferredJob, localJobs: Job[]): boolean {
 return job.status === 'Merenje' && localJobs.some(localJob => job.offlineSource === sourceOf(localJob));
}

async function transfer(job: Job, member: TeamMember): Promise<string> {
 if (!job.positions.length) throw new Error('Dodajte izmerene elemente pre prebacivanja u tim.');
 if (!navigator.onLine) throw new Error('Povežite se na internet da biste prebacili posao.');

 const offlineSource = sourceOf(job);
 let id = job.id;
 if (!teamIdPattern.test(id)) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(offlineSource));
  id = 'AT-' + Array.from(new Uint8Array(digest).slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
 }
 const worker = member.role === 'worker';
 const payload: TransferredJob = {
  ...job,
  ...(worker ? workerJobPricing(useStore.getState().settings.prices.transport) : {}),
  id,
  offlineSource,
  measuredOn: job.measuredOn || todayInBelgrade(),
  technician: member.name,
  status: 'Poslati ponudu',
  positions: worker ? job.positions.map(position => withPositionPrice(position)) : job.positions,
 };

 // The create RPC keeps the same row on retry and starts new worker jobs in Merenje.
 let row = await createTeamJob(payload);
 if ((row.data as TransferredJob).offlineSource !== offlineSource) {
  throw new TeamRequestError('U timu već postoji drugi posao sa ovim brojem.', '23505');
 }
 if (worker && row.data.status === 'Merenje') {
  row = await updateTeamJob(id, { status: 'Poslati ponudu' }, { status: 'Merenje' });
 }

 acceptTeamJob(row, member.id);
 try { localStorage.setItem(receiptKey(job), row.id); }
 catch { /* The team's job ID still makes a retry safe. */ }
 return row.id;
}

export function transferOfflineJob(job: Job, member: TeamMember): Promise<string> {
 const key = sourceOf(job) + member.id;
 const current = inFlight.get(key);
 if (current) return current;
 const pending = transfer(job, member).finally(() => inFlight.delete(key));
 inFlight.set(key, pending);
 return pending;
}
