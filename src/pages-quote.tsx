import { fmt } from './custom/geometry';
import { lazy, Suspense, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileText, Share2 } from 'lucide-react';
import { useStore } from './store';
import { calculate, euro, validatePosition, jobReviewLabel, positionReviewLabel } from './services/calculation';
import type { Position } from './models';
import { openingBoxHeight } from './shutters';
import { portaDecorName, portaRoyalTypes } from './porta-royal';
import { Modal } from './components/UI';
import { FieldHeader } from './components/FieldHeader';
import { Drawing } from './components/Drawing';
import { MissingJob } from './pages-editor';
import { downloadFile, makeDocument } from './services/documents';
import { prepareOfficeSubmission, sendOfficeSubmission, submissionSignature, type OfficeSubmission } from './services/office-submission';

const DocumentPreview = lazy(() => import('./components/DocumentPreview'));

function ShareAppIcons(){
 return <span className="share-app-icons"><img src="/assets/viber.svg" alt="Viber" title="Viber"/><img src="/assets/whatsapp.svg" alt="WhatsApp" title="WhatsApp"/></span>;
}

const unitPriceFormat = new Intl.NumberFormat('sr-Latn-RS', {useGrouping:false, minimumFractionDigits:2, maximumFractionDigits:2});

function QuotePositionPrice({position, price, onChange}: {
 position:Position;
 price:ReturnType<typeof calculate>['positions'][number];
 onChange:(price:number|null)=>void;
}){
 const [draft,setDraft]=useState<string|null>(null);
 const manual=position.manualPrice!==null;
 return <div className="quote-position-price">
  <div className="quote-price-controls">
   <label className={manual?'quote-price-input is-manual':'quote-price-input'}>
    <input aria-label={`Cena po komadu za ${position.name}`} inputMode="decimal" maxLength={16}
     value={draft??(price.requiresReview?'':unitPriceFormat.format(price.unit))} placeholder="—"
     onFocus={event=>event.currentTarget.select()} onBlur={()=>setDraft(null)}
     onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}
     onChange={event=>{
      const value=event.target.value;
      setDraft(value);
      if(!/^\d+(?:[.,]\d{0,2})?$/.test(value))return;
      const amount=Number(value.replace(',','.'));
      if(amount<=1e8)onChange(amount);
     }}/>
    <span aria-hidden="true">€/kom.</span>
   </label>
   <button type="button" className="quote-price-auto" title={price.requiresReview?positionReviewLabel(position):`Automatska cena ${euro(price.calculated)} po komadu`}
    aria-label={`Auto za ${position.name}`} onClick={()=>{setDraft(null);if(manual)onChange(null);}}>Auto</button>
  </div>
  {price.requiresReview&&position.portaRoyal&&<small>Cena po upitu</small>}
  {position.quantity>1&&!price.requiresReview&&<strong className="quote-line-total">Ukupno {euro(price.total)}</strong>}
 </div>;
}

export function Quote(){
 const {id}=useParams(),{jobs,settings,updatePosition}=useStore(),job=jobs.find(j=>j.id===id);
 const pendingSubmission=useRef<OfficeSubmission|null>(null),sending=useRef(false);
 const [officeNotice,setOfficeNotice]=useState<{text:string;kind:'progress'|'success'|'error'}|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[sharing,setSharing]=useState(false);
 const [preview,setPreview]=useState<{file:File;title:string}|null>(null);
 if(!job)return <MissingJob/>;
 const showPrices=settings.showPrices!==false;
 async function previewDocument(kind:'kupac'|'kancelarija'){
  if(!job)return;
  setBusy(true);
  setMessage('');
  try{
   const file=await makeDocument(job,settings,kind);
   setPreview({file,title:kind==='kupac'?'Ponuda za kupca':'Specifikacija za kancelariju'});
  }catch(error){
   setMessage(`Priprema dokumenta nije uspela: ${(error as Error).message}`);
  }finally{
   setBusy(false);
  }
 }
 const result=calculate(job,settings),errors=job.positions.flatMap((p,i)=>validatePosition(p).map(e=>`Element ${i+1}: ${e}`)),ready=job.positions.length>0&&!errors.length;
 async function shareDocument(kind:'kupac'|'kancelarija'){
  if(!job)return;setBusy(true);setMessage('');setOfficeNotice(null);
  try{const file=await makeDocument(job,settings,kind);
   if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:`ALU TIM 012 · ${job.id}`});setMessage('Dokument je predat sistemskom dijalogu za deljenje.');}
   else{downloadFile(file);setMessage('Deljenje fajlova nije podržano. PDF je pripremljen za preuzimanje.');}
   setSharing(false);
  }catch(error){setMessage((error as Error).name==='AbortError'?'Deljenje je otkazano.':`Izvoz nije uspeo: ${(error as Error).message}`);}finally{setBusy(false);}
 }
 async function sendToOffice(){
  if(!job||sending.current)return;
  if(!navigator.onLine){setOfficeNotice({kind:'error',text:'Za slanje u app potreban je internet. Posao ostaje sačuvan na ovom uređaju.'});return;}
  sending.current=true;setBusy(true);setOfficeNotice({kind:'progress',text:'Pripremam specifikaciju za kancelariju…'});
  try{
   const signature=submissionSignature(job,settings);
   if(pendingSubmission.current?.signature!==signature)pendingSubmission.current=await prepareOfficeSubmission(job,settings);
   await sendOfficeSubmission(pendingSubmission.current);
   setOfficeNotice({kind:'success',text:'Sačuvano'});
   // Keep the file and submission ID for safe retries of the same saved version.
  }catch(error){setOfficeNotice({kind:'error',text:(error as Error).message});}finally{sending.current=false;setBusy(false);}
 }
 return <div className="field-page price-page"><FieldHeader title={`${showPrices?"Cena i ponuda":"Dokumenti"}: ${job.customer.name}`} back={`/posao/${job.id}`}/>
 <main className={showPrices?"price-workspace":"price-workspace without-prices"}><div className="price-content"><section className="price-lines" aria-label={showPrices?"Pregled cene":"Pregled elemenata"}><div className="price-line-head"><span>Element</span><span>Kom.</span>{showPrices&&<span>Cena</span>}</div>
 {job.positions.map((p,i)=><article className="price-line" key={p.id}><Link className="price-element" to={`/posao/${job.id}/element/${p.id}`}><span className="price-sketch"><Drawing position={p} compact/></span><span><strong>{p.name}</strong><small>{fmt(p.width)} × {fmt(p.height+openingBoxHeight(p))} mm · {p.portaRoyal?`Tip ${portaRoyalTypes[p.portaRoyal.type]} · ${portaDecorName(p.portaRoyal)}`:p.material}</small></span></Link><span>{p.quantity}</span>{showPrices&&<QuotePositionPrice position={p} price={result.positions[i]} onChange={manualPrice=>updatePosition(job.id,p.id,{manualPrice})}/>}</article>)}
 {!job.positions.length&&<p className="field-empty-text">Dodajte element u posao da biste pripremili ponudu.</p>}
 </section>
 {showPrices&&<Link className="field-button field-button-yellow correction-entry" to={`/posao/${job.id}/korekcija`}>Korekcija cene</Link>}</div>
 {showPrices&&<aside className="price-total"><div><span>Elementi i odabrani radovi</span><strong>{euro(result.elements)}</strong></div><div><span>Transport i dodatni radovi</span><strong>{euro(result.services)}</strong></div>{result.discount>0&&<div><span>Popust {job.discountMode==='amount'?'':`${job.discount}%`}</span><strong>−{euro(result.discount)}</strong></div>}<hr/>{result.surcharge>0&&<div><span>Uvećanje</span><strong>{euro(result.surcharge)}</strong></div>}{result.manual&&<p>Ručna ukupna cena — popust i uvećanje se ne primenjuju.</p>}<div><span>Osnovica</span><strong>{euro(result.net)}</strong></div><div><span>{result.vatMode==='none'?'Bez obračuna PDV-a':`PDV ${result.vat}%${result.vatMode==='inclusive'?' (uključen)':''}`}</span><strong>{euro(result.tax)}</strong></div><section><h2>{result.hasUnpriced?'Zbir poznatih stavki':'Okvirna cena'}</h2><strong data-testid="quote-total">{euro(result.total)}</strong></section><p>{result.hasUnpriced?jobReviewLabel(job,result)+'. Zbir obuhvata stavke sa izračunatom cenom.':'Demonstracione cene. Konačnu ponudu potvrđuje kancelarija.'}</p></aside>}
 {errors.length>0&&<div className="field-error" role="alert">{errors.map((e,i)=><p key={i}>{e}</p>)}<Link to={`/posao/${job.id}`}>Ispravite mere u poslu</Link></div>}
 {message&&!sharing&&<p className="field-message" role="status">{message}</p>}
 </main>
 <footer className="field-bottom-actions document-actions"><button className="field-button field-button-light" disabled={!ready||busy} onClick={()=>previewDocument('kupac')}><FileText/>{busy?'Pripremam…':'Ponuda za kupca'}</button><button className="field-button field-button-light" disabled={!ready||busy} onClick={()=>previewDocument('kancelarija')}><FileText/>Specifikacija za kancelariju</button><button className="field-button field-button-yellow" aria-label="Podeli dokument" disabled={!ready||busy} onClick={()=>{setMessage('');setOfficeNotice(null);setSharing(true);}}><Share2/><span>Podeli</span></button></footer>
 {preview&&<Modal wide title={`Pregled: ${preview.title}`} onClose={()=>setPreview(null)}>
  <Suspense fallback={<p role="status">Učitavam pregled…</p>}>
   <DocumentPreview file={preview.file}/>
  </Suspense>
 </Modal>}
 {sharing&&<Modal title="Podeli dokument" onClose={()=>{setSharing(false);setOfficeNotice(null);}}><div className="share-choices"><button className="field-button field-button-light share-document-choice" aria-label="Ponuda za kupca" disabled={busy} onClick={()=>shareDocument('kupac')}><FileText/><span>Ponuda za kupca</span><ShareAppIcons/></button><button className="field-button field-button-light share-document-choice" aria-label="Specifikacija za kancelariju" disabled={busy} onClick={()=>shareDocument('kancelarija')}><FileText/><span>Specifikacija za kancelariju</span><ShareAppIcons/></button><button className="field-button field-button-light share-document-choice" aria-label="Pošalji u app" disabled={busy} onClick={sendToOffice}><FileText/><span>{busy?'Šaljem…':'Pošalji u app'}</span><img className="share-company-logo" src="/assets/logo.png" alt="ALU TIM 012"/></button><p>Za slanje izaberite Viber ili WhatsApp u sistemskom meniju, ako su instalirani na uređaju. Ako deljenje nije podržano, dokument se preuzima.</p><p>Pošalji u app čuva specifikaciju za kancelariju u bazi. Za to je potreban internet.</p>{officeNotice?<p role="status" className={`office-notice office-notice-${officeNotice.kind}`}>{officeNotice.kind==='success'&&<CheckCircle2 aria-hidden="true"/>}{officeNotice.text}</p>:message&&<p role="status">{message}</p>}</div></Modal>}
 </div>;
}
