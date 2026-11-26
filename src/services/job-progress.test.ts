import { describe, expect, it } from 'vitest';
import type { Job } from '../models';
import { isActiveJob } from '../models';
import { makePosition } from '../catalog';
import { canChangeJobStatus, canFinishMeasurement, hasCompletionDeadline, isJobDate, jobProgressPatch } from './job-progress';

const job={status:'Merenje',date:'2026-11-01',positions:[makePosition()],completionDeadline:'2099-12-20'} as Job;
describe('Evidencija posla',()=>{
 it('odvaja stvarni datum merenja od termina i pamti prve datume pri ponavljanju statusa',()=>{
  const measured={...job,...jobProgressPatch(job,{status:'Poslati ponudu'},'2026-11-25')};
  expect(measured.date).toBe('2026-11-01');expect(measured.measuredOn).toBe('2026-11-25');
  const complete={...measured,...jobProgressPatch(measured,{status:'Završeno'},'2026-12-04')};
  const installed={...complete,...jobProgressPatch(complete,{status:'Ugrađeno'},'2026-12-07')};
  expect(installed).toMatchObject({completedOn:'2026-12-04',installedOn:'2026-12-07',measuredOn:'2026-11-25'});
  expect(jobProgressPatch({...installed,status:'U izradi'},{status:'Ugrađeno'},'2026-12-10')).toMatchObject({completedOn:'2026-12-04',installedOn:'2026-12-07'});
  expect(isActiveJob(installed)).toBe(false);
 });
 it('ugradnja direktno iz izrade beleži završetak i ugradnju istog dana',()=>{
  expect(jobProgressPatch({...job,status:'U izradi'},{status:'Ugrađeno'},'2026-12-01')).toEqual({status:'Ugrađeno',completedOn:'2026-12-01',installedOn:'2026-12-01'});
 });
 it('ne pretpostavlja datume starih poslova i ne beleži odbijeno merenje kao izmereno',()=>{
  expect(jobProgressPatch({...job,status:'Završeno'},{notes:'Beleška'},'2026-11-25')).toEqual({notes:'Beleška'});
  expect(jobProgressPatch(job,{status:'Odbijeno'},'2026-11-25')).toEqual({status:'Odbijeno'});
 });
 it('merenju je dovoljan sačuvan element, a rok nije potreban',()=>{
  expect(canFinishMeasurement({...job,completionDeadline:''})).toBe(true);
  expect(canFinishMeasurement({...job,positions:[]})).toBe(false);
  expect(canChangeJobStatus({...job,completionDeadline:''},'Poslati ponudu')).toBe(true);
 });
 it('ne završava merenje dok svaki model salona nema potvrđene mere',()=>{
  const measured=makePosition(),pending={...makePosition(),measurementPending:true};
  expect(canFinishMeasurement({...job,positions:[measured,pending]})).toBe(false);
  expect(canFinishMeasurement({...job,positions:[measured,{...pending,measurementPending:false}]})).toBe(true);
 });
 it('blokira sve promene iz Ponude dok nije izabran važeći rok',()=>{
  const offer={...job,status:'Ponuda' as const,measuredOn:'2026-11-25',completionDeadline:''};
  expect(canChangeJobStatus(offer,'Ponuda')).toBe(true);
  for(const status of ['Merenje','Poslati ponudu','Prihvaćeno','Odbijeno','U izradi','Završeno','Ugrađeno'] as const){
   expect(canChangeJobStatus(offer,status)).toBe(false);
   expect(canChangeJobStatus(offer,status,'2026-02-30')).toBe(false);
   expect(canChangeJobStatus(offer,status,'2026-11-24')).toBe(false);
   expect(canChangeJobStatus(offer,status,'2026-12-15')).toBe(true);
  }
  expect(hasCompletionDeadline({...offer,completionDeadline:'2026-11-25'})).toBe(true);
  expect(hasCompletionDeadline({completionDeadline:'2026-11-25'})).toBe(true);
  expect(isJobDate('2028-02-29')).toBe(true);
  expect(isJobDate('2026-02-29')).toBe(false);
 });
});
