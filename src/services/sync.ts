import type { Job } from '../models';
// Future backend boundary. No network or simulated successful synchronization.
export interface SyncService { push(jobs:Job[]):Promise<void>; pull():Promise<Job[]> }
export const synchronizationAvailable=false;
