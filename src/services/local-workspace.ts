import type { Job } from '../models';
import { parseBackup, recoverLocalSnapshot, type LocalSnapshot } from './storage';

export const localWorkspaceKey = 'alu-tim-teren-v1';
export const localSaveError = 'Nema dovoljno lokalnog prostora ili je čuvanje blokirano. Izvezite rezervnu kopiju i uklonite velike fotografije.';
const loadError = 'Lokalni podaci nisu dostupni ili su oštećeni.';
const conflictMessage = 'Isti lokalni podatak je izmenjen u drugom tabu. Izvezite rezervnu kopiju trenutnih izmena pre ponovnog učitavanja.';

type JobRecord = { job: Job; deletedAt?: string };
type LocalRead = { data: LocalSnapshot; raw: string | null; damaged: boolean };

function sameValue(a: unknown, b: unknown) {
 return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function recordsOf({ jobs, trash }: LocalSnapshot): Map<string, JobRecord> {
 return new Map([
  ...jobs.map(job => [job.id, { job }] as const),
  ...trash.map(entry => [entry.job.id, entry] as const),
 ]);
}

function sameRecord(a: JobRecord | undefined, b: JobRecord | undefined) {
 return a?.deletedAt === b?.deletedAt && sameValue(a?.job, b?.job);
}

// Reapply this tab's changes to the most recent persisted data.
function mergeSnapshots(base: LocalSnapshot, next: LocalSnapshot, current: LocalSnapshot): LocalSnapshot {
 if (base === current) return next;
 const before = recordsOf(base), after = recordsOf(next), latest = recordsOf(current);
 for (const id of new Set([...before.keys(), ...after.keys()])) {
  const oldRecord = before.get(id), newRecord = after.get(id), currentRecord = latest.get(id);
  if (sameRecord(oldRecord, newRecord)) continue;
  if (!sameRecord(oldRecord, currentRecord) && !sameRecord(newRecord, currentRecord)) throw new LocalConflict();
  if (newRecord) latest.set(id, newRecord);
  else latest.delete(id);
 }
 const jobs: Job[] = [], trash: LocalSnapshot['trash'] = [];
 const moved = [...after].filter(([id, entry]) => {
  const previous = before.get(id);
  return !previous || (previous.deletedAt === undefined) !== (entry.deletedAt === undefined);
 }).map(([id]) => id);
 const orderedIds = new Set([...moved, ...latest.keys()]);
 for (const id of orderedIds) {
  const entry = latest.get(id);
  if (!entry) continue;
  if (entry.deletedAt === undefined) jobs.push(entry.job);
  else trash.push({ job: entry.job, deletedAt: entry.deletedAt });
 }
 const settings = { ...current.settings };
 for (const key of Object.keys({ ...base.settings, ...next.settings }) as (keyof LocalSnapshot['settings'])[]) {
  if (sameValue(base.settings[key], next.settings[key])) continue;
  if (!sameValue(base.settings[key], current.settings[key]) && !sameValue(next.settings[key], current.settings[key])) throw new LocalConflict();
  Object.assign(settings, { [key]: next.settings[key] });
 }
 return { jobs, trash, settings };
}

export class LocalConflict extends Error {
 constructor() { super(conflictMessage); }
}

export class LocalWorkspaceStorage {
 private saved: LocalRead;

 constructor(private readonly storage: () => Storage, private readonly empty: LocalSnapshot) {
  this.saved = { data: empty, raw: null, damaged: false };
 }

 get snapshot() { return this.saved.data; }

 load() {
  try {
   this.saved = this.read();
   return { data: this.saved.data, error: this.saved.damaged ? loadError + ' Učitani su ispravni zapisi.' : '' };
  } catch {
   return { data: this.saved.data, error: loadError };
  }
 }

 save(next: LocalSnapshot, replace = false) {
  const current = this.read();
  const merged = replace ? next : mergeSnapshots(this.saved.data, next, current.data);
  const raw = JSON.stringify({ jobs: merged.jobs, trash: merged.trash, settings: merged.settings });
  const storage = this.storage();
  if (current.damaged && current.raw !== null) this.keepRecoveryCopy(storage, current.raw);
  if (raw !== current.raw) storage.setItem(localWorkspaceKey, raw);
  this.saved = { data: merged, raw, damaged: false };
  return merged;
 }

 private read(): LocalRead {
  const raw = this.storage().getItem(localWorkspaceKey);
  if (raw === this.saved.raw) return this.saved;
  if (raw === null) return { data: this.empty, raw, damaged: false };
  let value: unknown;
  try {
   value = JSON.parse(raw);
   return { data: parseBackup(value), raw, damaged: false };
  } catch {
   return { data: recoverLocalSnapshot(value, this.empty.settings), raw, damaged: true };
  }
 }

 private keepRecoveryCopy(storage: Storage, raw: string) {
  for (let index = 0; ; index++) {
   const key = localWorkspaceKey + ':recovery:' + index;
   const previous = storage.getItem(key);
   if (previous === raw) return;
   if (previous === null) {
    storage.setItem(key, raw);
    return;
   }
  }
 }
}
