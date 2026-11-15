import type { Job, Settings } from '../models';
import { makeDocument } from './documents';
import { getSupabase } from './supabase';

export type JobDocumentKind = 'kupac' | 'kancelarija';
export type ArchivedJobDocument = { kind: JobDocumentKind; name: string; createdAt: string; hasPrices: boolean };

const bucket = () => getSupabase().storage.from('alutim-job-documents');
const folder = (jobId: string, kind: JobDocumentKind) => 'stolarija/' + jobId + '/' + kind;
const validName = /^[a-f0-9-]{36}_(cene|bez-cena)_[a-f0-9]{64}\.pdf$/;
export const jobDocumentTitle = (kind: JobDocumentKind) => kind === 'kupac' ? 'Ponuda za kupca' : 'Specifikacija za kancelariju';

function archivedFile(blob: Blob, jobId: string, kind: JobDocumentKind) {
 return new File([blob], jobId + (kind === 'kupac' ? '-ponuda.pdf' : '-specifikacija.pdf'), { type: 'application/pdf' });
}

async function versionFileName(job: Job, settings: Settings) {
 const { prices, portaRoyalPrices, vat, vatMode, showPrices } = settings;
 const pricing = showPrices === false ? null : { prices, portaRoyalPrices, vat, vatMode };
 const signature = JSON.stringify({ format: 1, job, pricing }, (_key, value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
 });
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
 return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') + '.pdf';
}

export async function createJobDocument(job: Job, settings: Settings, kind: JobDocumentKind, authorId?: string): Promise<File> {
 if (!authorId) return makeDocument(job, settings, kind);
 const priceMode = settings.showPrices === false ? 'bez-cena' : 'cene';
 const name = authorId + '_' + priceMode + '_' + await versionFileName(job, settings);
 const path = folder(job.id, kind) + '/' + name;
 const storage = bucket();
 const existing = await storage.exists(path);
 if (existing.data) return downloadJobDocument(job.id, { kind, name });

 const file = await makeDocument(job, settings, kind);
 const saved = await storage.upload(path, file, { contentType: 'application/pdf', upsert: false });
 if (!saved.error) return file;

 // Another device can save the same version first, or the upload response can be lost.
 const stored = await storage.download(path);
 if (stored.data && !stored.error) return archivedFile(stored.data, job.id, kind);
 throw new Error('Dokument nije sačuvan u bazi. Proverite vezu i pokušajte ponovo.');
}

export async function listJobDocuments(jobId: string): Promise<ArchivedJobDocument[]> {
 const storage = bucket();
 const groups = await Promise.all((['kupac', 'kancelarija'] as const).map(async kind => {
  const documents: ArchivedJobDocument[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
   const { data, error } = await storage.list(folder(jobId, kind), { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
   if (error) throw new Error('Sačuvani dokumenti trenutno nisu dostupni.');
   for (const entry of data) {
    const match = validName.exec(entry.name);
    if (entry.id && entry.created_at && match) documents.push({ kind, name: entry.name, createdAt: entry.created_at, hasPrices: match[1] === 'cene' });
   }
   if (data.length < pageSize) return documents;
  }
 }));
 return groups.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function downloadJobDocument(jobId: string, document: Pick<ArchivedJobDocument, 'kind' | 'name'>): Promise<File> {
 if (!validName.test(document.name)) throw new Error('Oznaka dokumenta nije ispravna.');
 const { data, error } = await bucket().download(folder(jobId, document.kind) + '/' + document.name);
 if (error || !data) throw new Error('Dokument trenutno nije dostupan.');
 return archivedFile(data, jobId, document.kind);
}
