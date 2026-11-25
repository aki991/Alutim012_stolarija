import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { downloadJobDocument, jobDocumentTitle, listJobDocuments, type ArchivedJobDocument } from '../services/document-archive';

const dateFormat = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Belgrade' });

export function JobDocumentArchive({ jobId, revision, showPrices, onPreview }: {
 jobId: string;
 revision: number;
 showPrices: boolean;
 onPreview: (file: File, title: string) => void;
}) {
 const [open, setOpen] = useState(false);
 const [retry, setRetry] = useState(0);
 const [documents, setDocuments] = useState<ArchivedJobDocument[] | null>(null);
 const [listError, setListError] = useState('');
 const [openError, setOpenError] = useState('');
 const [opening, setOpening] = useState(false);
 const pricesVisible=useRef(showPrices);pricesVisible.current=showPrices;
 const visible = showPrices ? documents : documents?.filter(document => !document.hasPrices);

 useEffect(() => {
  if (!open) return;
  let active = true;
  setListError('');
  void listJobDocuments(jobId).then(rows => {
   if (active) setDocuments(rows);
  }).catch(error => {
   if (active) setListError((error as Error).message);
  });
  return () => { active = false; };
 }, [jobId, open, retry, revision]);

 async function preview(document: ArchivedJobDocument) {
  setOpening(true);
  setOpenError('');
  try {
   const file=await downloadJobDocument(jobId, document);
   if(!document.hasPrices||pricesVisible.current)onPreview(file, jobDocumentTitle(document.kind));
  }
  catch (error) { setOpenError((error as Error).message); }
  finally { setOpening(false); }
 }

 return <details className="job-document-archive" onToggle={event => setOpen(event.currentTarget.open)}>
  <summary>Sačuvani dokumenti</summary>
  {open && <div>
   {listError ? <><p role="alert">{listError}</p><button type="button" className="field-button field-button-light" onClick={() => setRetry(value => value + 1)}>Pokušaj ponovo</button></>
    : !visible ? <p role="status">Učitavam dokumente…</p>
    : visible.length === 0 ? <p>Nema sačuvanih dokumenata za trenutni prikaz.</p>
    : <ul>{visible.map(document => <li key={document.kind + document.name}>
     <button type="button" className="field-button field-button-light" disabled={opening} onClick={() => void preview(document)}>
      <FileText size={18} aria-hidden="true"/>{jobDocumentTitle(document.kind)}{showPrices&&!document.hasPrices?' · bez cena':''}
     </button>
     <time dateTime={document.createdAt}>{dateFormat.format(new Date(document.createdAt))}</time>
    </li>)}</ul>}
   {openError && <p role="alert">{openError}</p>}
  </div>}
 </details>;
}
