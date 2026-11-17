import type { Job } from '../models';
import type { TeamJob, TeamMember, TeamPreferences } from './team-api';

export type TeamMutation =
 | { type:'create'; job:Job }
 | { type:'update'; id:string; patch:Partial<Job>; expected:Partial<Job>; updated:string }
 | { type:'delete'; job:Job; revision?:number }
 | { type:'preferences'; patch:TeamPreferences };

const queueKey = (memberId: string) => 'alu-team-pending-v1:' + memberId;

export function readTeamMutations(memberId: string): TeamMutation[] {
 try {
  const pending = JSON.parse(sessionStorage.getItem(queueKey(memberId)) ?? '[]');
  return Array.isArray(pending) ? pending : [];
 } catch {
  return [];
 }
}

export function writeTeamMutations(memberId: string, pending: readonly TeamMutation[]) {
 const key = queueKey(memberId);
 if (pending.length) sessionStorage.setItem(key, JSON.stringify(pending));
 else sessionStorage.removeItem(key);
}

export function mutationTarget(change: TeamMutation) {
 if (change.type === 'preferences') return null;
 return change.type === 'update' ? change.id : change.job.id;
}

export function jobsWithPendingChanges(rows: ReadonlyMap<string, TeamJob>, pending: readonly TeamMutation[], member: TeamMember) {
 const jobs = new Map([...rows].map(([id, row]) => [id, row.data]));
 for (const change of pending) {
  if (change.type === 'create') jobs.set(change.job.id, change.job);
  else if (change.type === 'delete') jobs.delete(change.job.id);
  else if (change.type === 'update') {
   const job = jobs.get(change.id), row = rows.get(change.id);
   if (job && (!row || member.role === 'manager' || row.assigned_to === member.id)) {
    jobs.set(change.id, { ...job, ...change.patch, updated: change.updated });
   }
  }
 }
 return [...jobs.values()].sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
}
