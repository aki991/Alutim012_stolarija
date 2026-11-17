import type { Position } from '../models';
import { parseStoredPosition } from './storage';

export function positionDraft(key: string, memberId: string | undefined, offline: boolean, wasSaved: () => boolean) {
 const persistent = offline && !memberId;
 const storageKey = memberId ? `alu-team-draft:${memberId}:${key}` : key;
 const storage = () => persistent ? localStorage : sessionStorage;

 return {
  read(): Position | null {
   try {
    const raw = storage().getItem(storageKey) ?? (persistent ? sessionStorage.getItem(key) : null);
    return raw === null ? null : parseStoredPosition(JSON.parse(raw));
   } catch {
    return null;
   }
  },
  write: (position: Position) => storage().setItem(storageKey, JSON.stringify(position)),
  commit(save: () => void, keepDraft = false) {
   if (!persistent) {
    save();
    const saved = wasSaved();
    if (saved && !keepDraft) try { sessionStorage.removeItem(storageKey); } catch { /* The update was already saved. */ }
    return saved;
   }
   // Free space before saving the same photos as part of the job.
   let previous: string | null = null;
   try {
    previous = localStorage.getItem(storageKey);
    localStorage.removeItem(storageKey);
   } catch { /* The job save reports storage failures. */ }
   let saved = false;
   try {
    save();
    saved = wasSaved();
    return saved;
   } finally {
    try {
     if (saved) sessionStorage.removeItem(key);
     else if (previous !== null) localStorage.setItem(storageKey, previous);
    } catch { /* Keep the existing job storage error. */ }
   }
  },
 };
}
