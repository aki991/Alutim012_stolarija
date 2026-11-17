import { useSyncExternalStore } from 'react';
import type { Job } from '../models';

const belgradeDate = new Intl.DateTimeFormat('en-CA', {
 timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function todayInBelgrade(now = new Date()) {
 return belgradeDate.format(now);
}

export function scheduledMeasurementDate(job: Pick<Job, 'date' | 'status'>, assigned: boolean, today: string) {
 if (assigned && job.status === 'Merenje' && job.date && job.date < today) return today;
 return job.date;
}

export function formatMeasurementDate(date: string) {
 return new Date(date + 'T12:00:00').toLocaleDateString('sr-Latn-RS');
}

function subscribeToDay(listener: () => void) {
 const timer = window.setInterval(listener, 15_000);
 window.addEventListener('focus', listener);
 document.addEventListener('visibilitychange', listener);
 return () => {
  window.clearInterval(timer);
  window.removeEventListener('focus', listener);
  document.removeEventListener('visibilitychange', listener);
 };
}

export function useBelgradeToday() {
 return useSyncExternalStore(subscribeToDay, todayInBelgrade);
}
