import type { Job } from '../models';
import { todayInBelgrade } from './measurement-schedule';

export const progressDateFields = ['completionDeadline','measuredOn','completedOn','installedOn'] as const;
export function isJobDate(value: unknown): value is string {
 return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number(value.slice(0,4))>0 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}

// Scheduled measurement dates remain separate from the actual milestone dates.
export function jobProgressPatch(job:Job,patch:Partial<Job>,today=todayInBelgrade()):Partial<Job>{
 const next={...patch};
 if(!patch.status||patch.status===job.status)return next;
 if(job.status==='Merenje'&&!['Merenje','Odbijeno'].includes(patch.status))next.measuredOn=job.measuredOn||today;
 if(patch.status==='Završeno'||patch.status==='Ugrađeno')next.completedOn=job.completedOn||today;
 if(patch.status==='Ugrađeno')next.installedOn=job.installedOn||today;
 return next;
}

export function canFinishMeasurement(job:Job){
 return job.positions.length>0&&isJobDate(job.completionDeadline)
  &&job.completionDeadline>=(job.measuredOn||todayInBelgrade());
}
