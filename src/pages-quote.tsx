import { fmt } from './custom/geometry';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Download, FileText, Mail, Share2 } from 'lucide-react';
import { useStore } from './store';
import type { Package } from './models';
import { calculate, euro, packages, validatePosition, positionPriceLabel, reviewPrice } from './services/calculation';
import { Field, Modal } from './components/UI';
import { FieldHeader } from './components/FieldHeader';
import { Drawing } from './components/Drawing';
import { MissingJob } from './pages-editor';
import { downloadFile, makeDocument } from './services/documents';

export function Quote(){
 const {id}=useParams(),{jobs,settings,updateJob,updatePosition}=useStore(),job=jobs.find(j=>j.id===id);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[sharing,setSharing]=useState(false);
 if(!job)return <MissingJob/>;
 const result=calculate(job,settings),errors=job.positions.flatMap((p,i)=>validatePosition(p).map(e=>`Element ${i+1}: ${e}`)),ready=job.positions.length>0&&!errors.length;
 async function exportDocument(kind:'kupac'|'kancelarija',share=false){
  if(!job)return;setBusy(true);setMessage('');
  try{const file=await makeDocument(job,settings,kind);
   if(share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:`ALU TIM 012 · ${job.id}`});setMessage('Dokument je predat sistemskom dijalogu za deljenje.');}
   else{downloadFile(file);setMessage(share?'Deljenje fajlova nije podržano. PDF je pripremljen za preuzimanje.':'PDF je pripremljen za preuzimanje.');}
   setSharing(false);
  }catch(error){setMessage((error as Error).name==='AbortError'?'Deljenje je otkazano.':`Izvoz nije uspeo: ${(error as Error).message}`);}finally{setBusy(false);}
 }
 return <div className="field-page price-page"><FieldHeader title={`Cena i ponuda: ${job.customer.name}`} back={`/posao/${job.id}`}/>
 <main className="price-workspace"><div className="price-content"><section className="price-lines" aria-label="Pregled cene"><div className="price-line-head"><span>Element</span><span>Kom.</span><span>Cena</span></div>
 {job.positions.map((p,i)=><article className="price-line" key={p.id}><Link className="price-element" to={`/posao/${job.id}/element/${p.id}`}><span className="price-sketch"><Drawing position={p} compact/></span><span><strong>{p.name}</strong><small>{fmt(p.width)} × {fmt(p.height)} mm · {p.material}</small></span></Link><span>{p.quantity}</span><strong>{positionPriceLabel(p,result.positions[i].total)}</strong></article>)}
 {!job.positions.length&&<p className="field-empty-text">Dodajte element u posao da biste pripremili ponudu.</p>}
 </section>
 <details className="price-adjustments"><summary>Korekcija cene i uslovi</summary><div className="price-adjustment-body"><div className="field-options-grid"><Field label="Popust (%)"><input type="number" inputMode="decimal" min={0} max={100} value={job.discount} onChange={e=>updateJob(job.id,{discount:Math.max(0,Math.min(100,+e.target.value))})}/></Field><Field label="Transport (€)"><input type="number" inputMode="decimal" min={0} value={job.transport} onChange={e=>updateJob(job.id,{transport:Math.max(0,+e.target.value)})}/></Field><Field label="Dodatni radovi za ceo posao (€)"><input type="number" inputMode="decimal" min={0} value={job.extraCost} onChange={e=>updateJob(job.id,{extraCost:Math.max(0,+e.target.value)})}/></Field><Field label="Opis dodatnih radova"><input maxLength={300} value={job.extraWork} onChange={e=>updateJob(job.id,{extraWork:e.target.value})}/></Field></div>
 <h2>Nivo ponude</h2><div className="field-packages">{(Object.keys(packages) as Package[]).map(pkg=><button key={pkg} className={job.package===pkg?'selected':''} aria-pressed={job.package===pkg} onClick={()=>updateJob(job.id,{package:pkg})}><strong>{pkg}</strong><small>{packages[pkg].description}</small></button>)}</div>
 <h2>Ručna cena po komadu</h2><div className="field-options-grid">{job.positions.map((p,i)=><Field key={p.id} label={`${i+1}. ${p.name} (€)`}><input aria-label={`Ručna cena ${i+1}`} type="number" min={0} inputMode="decimal" placeholder={p.customGeometry?'Provera u kancelariji':'Automatski obračun'} value={p.manualPrice??''} onChange={e=>updatePosition(job.id,p.id,{manualPrice:e.target.value===''?null:Math.max(0,+e.target.value)})}/></Field>)}</div>
 <h2>Način obračuna</h2>{job.positions.map((p,i)=><details className="element-breakdown" key={p.id}><summary>{i+1}. {p.name}</summary>{result.positions[i].requiresReview&&<p>{reviewPrice}</p>}{result.positions[i].lines.map((line,k)=><div key={k}><span>{line.name}<small>{line.basis}</small></span><strong>{euro(line.amount)}</strong></div>)}{p.manualPrice!==null&&<div><span>Ručna korekcija po komadu</span><strong>{euro(p.manualPrice)}</strong></div>}</details>)}
 <div className="field-options-grid"><Field label="Važenje ponude"><input maxLength={200} value={job.validity} onChange={e=>updateJob(job.id,{validity:e.target.value})}/></Field><Field label="Način plaćanja"><input maxLength={200} value={job.payment} onChange={e=>updateJob(job.id,{payment:e.target.value})}/></Field><Field label="Rok isporuke"><input maxLength={300} value={job.delivery} onChange={e=>updateJob(job.id,{delivery:e.target.value})}/></Field></div>
 <button className="field-button field-button-light" onClick={()=>{updateJob(job.id,{status:'Ponuda'});setMessage('Posao je označen kao ponuda.');}}><Check/>Označi kao ponudu</button>
 </div></details></div>
 <aside className="price-total"><div><span>Elementi i odabrani radovi</span><strong>{euro(result.elements)}</strong></div><div><span>Transport i dodatni radovi</span><strong>{euro(result.services)}</strong></div>{job.discount>0&&<div><span>Popust {job.discount}%</span><strong>−{euro(result.discount)}</strong></div>}<hr/><div><span>Osnovica</span><strong>{euro(result.net)}</strong></div><div><span>{settings.vatMode==='none'?'Bez obračuna PDV-a':`PDV ${settings.vat}%${settings.vatMode==='inclusive'?' (uključen)':''}`}</span><strong>{euro(result.tax)}</strong></div><section><h2>{result.hasUnpriced?'Zbir poznatih stavki':'Okvirna cena'}</h2><strong data-testid="quote-total">{euro(result.total)}</strong></section><p>{result.hasUnpriced?reviewPrice+'. Zbir ne uključuje elemente bez ručne cene.':'Demonstracione cene. Konačnu ponudu potvrđuje kancelarija.'}</p></aside>
 {errors.length>0&&<div className="field-error" role="alert">{errors.map((e,i)=><p key={i}>{e}</p>)}<Link to={`/posao/${job.id}`}>Ispravite mere u poslu</Link></div>}
 {message&&<p className="field-message" role="status">{message}</p>}
 </main>
 <footer className="field-bottom-actions document-actions"><button className="field-button field-button-light" disabled={!ready||busy} onClick={()=>exportDocument('kupac')}><FileText/>{busy?'Pripremam…':'Ponuda za kupca'}</button><button className="field-button field-button-light" disabled={!ready||busy} onClick={()=>exportDocument('kancelarija')}><FileText/>Specifikacija za kancelariju</button><button className="field-button field-button-yellow" aria-label="Podeli dokument" disabled={!ready||busy} onClick={()=>setSharing(true)}><Share2/><span>Podeli</span></button></footer>
 {sharing&&<Modal title="Podeli dokument" onClose={()=>setSharing(false)}><div className="share-choices"><button className="field-button field-button-light" disabled={busy} onClick={()=>exportDocument('kupac',true)}><FileText/>Ponuda za kupca</button><button className="field-button field-button-light" disabled={busy} onClick={()=>exportDocument('kancelarija',true)}><FileText/>Specifikacija za kancelariju</button><a className="field-button field-button-light" href={`mailto:${encodeURIComponent(job.customer.email)}?subject=${encodeURIComponent(`ALU TIM 012 - ${job.id}`)}&body=${encodeURIComponent('Poštovani,\n\nŠaljemo okvirnu ponudu. Preuzeti PDF dodajte ručno u ovu poruku.\n\nALU TIM 012')}`}><Mail/>Pripremi email</a><p>PDF dodajte email poruci ručno. Ako deljenje nije podržano, dokument se preuzima.</p>{message&&<p role="status">{message}</p>}</div></Modal>}
 </div>;
}
