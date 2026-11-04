import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { downloadFile } from '../services/documents';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function DocumentPreview({ file }: { file: File }) {
 const stage = useRef<HTMLDivElement>(null);
 const [pdf, setPdf] = useState<PDFDocumentProxy>();
 const [pageNumber, setPageNumber] = useState(1);
 const [renderedPage, setRenderedPage] = useState(0);
 const [error, setError] = useState(false);
 const [zoomed, setZoomed] = useState(false);

 useEffect(() => {
  let active = true;
  let loading: ReturnType<typeof getDocument> | undefined;
  async function load() {
   const data = await file.arrayBuffer();
   if (!active) return;
   loading = getDocument({ data, useWasm: false, disableWorkerRendering: true });
   const document = await loading.promise;
   if (active) setPdf(document);
  }
  void load().catch(() => { if (active) setError(true); });
  return () => {
   active = false;
   void loading?.destroy().catch(() => {});
  };
 }, [file]);

 useEffect(() => {
  if (!pdf) return;
  let active = true;
  let rendering: RenderTask | undefined;
  async function draw(document: PDFDocumentProxy) {
   const page = await document.getPage(pageNumber);
   if (!active) return;
   const viewport = page.getViewport({ scale: 2 });
   const canvas = window.document.createElement('canvas');
   canvas.width = Math.ceil(viewport.width);
   canvas.height = Math.ceil(viewport.height);
   canvas.setAttribute('role', 'img');
   canvas.setAttribute('aria-label', `Strana ${pageNumber} dokumenta`);
   rendering = page.render({ canvas, viewport });
   await rendering.promise;
   if (active) {
    stage.current?.replaceChildren(canvas);
    stage.current?.scrollTo(0, 0);
    setRenderedPage(pageNumber);
   }
  }
  void draw(pdf).catch(() => { if (active) setError(true); });
  return () => {
   active = false;
   rendering?.cancel();
  };
 }, [pdf, pageNumber]);

 const ready = renderedPage === pageNumber;
 return <div className="document-preview">
  {error ? <p role="alert">Pregled nije dostupan u ovom pregledaču. PDF možete preuzeti ispod.</p>
   : !ready && <p role="status">Pripremam prikaz dokumenta…</p>}
  {ready && !error && <button className="field-button field-button-light document-preview-zoom" aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}>Uvećaj prikaz</button>}
  <div ref={stage} className={zoomed?"document-preview-page zoomed":"document-preview-page"} tabIndex={0} hidden={!ready || error}/>
  {pdf && pdf.numPages > 1 && !error && <div className="document-preview-navigation">
   <button className="field-button field-button-light" disabled={!ready || pageNumber === 1} onClick={() => setPageNumber(pageNumber - 1)}>Prethodna</button>
   <span>Strana {pageNumber} / {pdf.numPages}</span>
   <button className="field-button field-button-light" disabled={!ready || pageNumber === pdf.numPages} onClick={() => setPageNumber(pageNumber + 1)}>Sledeća</button>
  </div>}
  <button className="field-button field-button-yellow" disabled={!ready && !error} onClick={() => downloadFile(file)}><Download aria-hidden="true"/>Preuzmi PDF</button>
 </div>;
}
