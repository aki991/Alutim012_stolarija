import { NumberInput } from './components/NumberInput';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useStore } from './store';
import type { Job } from './models';
import { calculate, euro, packages } from './services/calculation';
import { Field } from './components/UI';
import { FieldHeader } from './components/FieldHeader';
import { Drawing } from './components/Drawing';
import { MissingJob } from './pages-editor';

export function Correction(){
 const {id}=useParams(),job=useStore(s=>s.jobs.find(j=>j.id===id));
 return job?<PriceCorrection key={job.id} job={job}/>:<MissingJob/>;
}
function PriceCorrection({job}:{job:Job}){
 const {settings,updateJob}=useStore();
 const [draft,setDraft]=useState<Job>(()=>structuredClone(job)),[message,setMessage]=useState('');
 const patch=(p:Partial<Job>)=>{setDraft(d=>({...d,...p}));setMessage('');};
 const c=calculate(draft,settings),manual=draft.manualTotal!=null;
 const taxHint=c.vatMode==='exclusive'?'Cene elemenata i korekcije su bez PDV-a. PDV se dodaje jednom.':c.vatMode==='inclusive'?'Cene elemenata i korekcije već sadrže PDV.':'Bez obračuna PDV-a.';
 function save(){
  const current=useStore.getState().jobs.find(j=>j.id===job.id);if(!current)return;
  const {package:tier,discount,discountMode,surcharge,surchargeMode,manualTotal,transport,extraWork,extraCost,vat,vatMode,validity,payment,delivery}=draft;
  updateJob(job.id,{package:tier,discount,discountMode,surcharge,surchargeMode,manualTotal,transport,extraWork,extraCost,vat,vatMode,validity,payment,delivery,
   positions:current.positions.map(p=>{const edited=draft.positions.find(d=>d.id===p.id);return edited?{...p,manualPrice:edited.manualPrice}:p;})});
  useStore.getState().retrySave();setMessage('Cena je sačuvana. PDF koristi ove cene.');
 }
 return <div className="field-page correction-page"><FieldHeader title="Korekcija cene" back={`/posao/${job.id}`}/>
 <form className="correction-form" onSubmit={e=>{e.preventDefault();save();}}><main className="correction-workspace">
 <section className="correction-elements"><h2>Cene elemenata</h2><p className="price-mode-note">Ručna cena je po komadu. Prazno polje vraća automatski obračun.</p>
 {draft.positions.map((p,i)=><article className="correction-element" key={p.id}><span className="price-sketch"><Drawing position={p} compact/></span><div><strong>{p.name}</strong><small>{Math.round(p.width)} × {Math.round(p.height)} mm · {p.quantity} kom.</small><span>Stavka ukupno: {p.customGeometry&&p.manualPrice===null?'Za proveru':euro(c.positions[i].total)}</span></div>
 <Field label={`Cena po komadu ${i+1} (€)`}><input aria-label={`Ručna cena ${i+1}`} type="number" inputMode="decimal" min={0} max={1e8} step="0.01" value={p.manualPrice??''} placeholder={p.customGeometry?'Za proveru':c.positions[i].calculated.toFixed(2)} onChange={e=>patch({positions:draft.positions.map(d=>d.id===p.id?{...d,manualPrice:e.target.value===''?null:+e.target.value}:d)})}/></Field></article>)}
 </section>
 <div className="correction-settings"><section className="correction-card"><h2>Brza korekcija</h2><p className="price-mode-note">{taxHint}</p>
 <fieldset disabled={manual} className="quick-adjustments"><div className="adjustment-row"><Field label="Popust"><NumberInput clearToZero aria-label="Popust" inputMode="decimal" step="0.01" min={0} max={draft.discountMode==='amount'?1e8:100} value={draft.discount} onChange={e=>patch({discount:+e.target.value})}/></Field><Field label="Vrsta popusta"><select value={draft.discountMode??'percent'} onChange={e=>patch({discountMode:e.target.value as 'percent'|'amount',discount:0})}><option value="percent">%</option><option value="amount">€</option></select></Field></div>
 <div className="adjustment-row"><Field label="Uvećanje"><NumberInput clearToZero aria-label="Uvećanje" inputMode="decimal" step="0.01" min={0} max={1e8} value={draft.surcharge??0} onChange={e=>patch({surcharge:+e.target.value})}/></Field><Field label="Vrsta uvećanja"><select value={draft.surchargeMode??'percent'} onChange={e=>patch({surchargeMode:e.target.value as 'percent'|'amount',surcharge:0})}><option value="percent">%</option><option value="amount">€</option></select></Field></div>
 <p className="price-mode-note">Uvećanje se primenjuje nakon popusta. Popust ne može preći zbir stavki.</p></fieldset>
 <label className="manual-total-toggle"><input type="checkbox" checked={manual} onChange={e=>patch({manualTotal:e.target.checked?Number(c.total.toFixed(2)):null})}/>Ručna ukupna cena</label>
 {manual&&<Field label="Konačna cena sa PDV-om (€)"><NumberInput inputMode="decimal" required min={0} max={1e8} step="0.01" value={draft.manualTotal??''} onChange={e=>patch({manualTotal:+e.target.value})}/></Field>}
 <p className="price-mode-note" role="status">{manual?'Aktivna je ručna ukupna cena. To je konačan iznos za plaćanje; popust i uvećanje se ne primenjuju.':'Aktivan je obračun po stavkama, sa popustom i uvećanjem.'}</p></section>
 <section className="correction-total"><div><span>Osnovica</span><strong>{euro(c.net)}</strong></div><div><span>{c.vatMode==='none'?'Bez PDV-a':`PDV ${c.vat}%`}</span><strong>{euro(c.tax)}</strong></div><div><h2>{c.hasUnpriced?'Zbir poznatih stavki':'Okvirna cena'}</h2><strong data-testid="correction-total">{euro(c.total)}</strong></div>{c.hasUnpriced&&<p>Elementi bez ručne cene čekaju proveru i nisu uključeni u zbir.</p>}</section>
 </div>
 <details className="correction-card correction-advanced"><summary>Napredne opcije</summary><div className="advanced-content"><h2>Nivo ponude</h2><div className="field-packages">{(Object.keys(packages) as Job['package'][]).map(tier=><button type="button" key={tier} className={draft.package===tier?'selected':''} aria-pressed={draft.package===tier} onClick={()=>patch({package:tier})}><strong>{tier}</strong><small>{packages[tier].description}</small></button>)}</div>
 <div className="form-grid"><Field label="Transport (€)"><NumberInput clearToZero min={0} max={1e8} step="0.01" value={draft.transport} onChange={e=>patch({transport:+e.target.value})}/></Field><Field label="Dodatni radovi za ceo posao (€)"><NumberInput clearToZero min={0} max={1e8} step="0.01" value={draft.extraCost} onChange={e=>patch({extraCost:+e.target.value})}/></Field><Field label="Opis dodatnih radova"><input maxLength={300} value={draft.extraWork} onChange={e=>patch({extraWork:e.target.value})}/></Field>
 <Field label="PDV (%)"><NumberInput clearToZero min={0} max={100} step="0.01" value={c.vat} onChange={e=>patch({vat:+e.target.value})}/></Field><Field label="Poreski režim"><select value={c.vatMode} onChange={e=>patch({vatMode:e.target.value as Job['vatMode']})}><option value="exclusive">PDV se dodaje</option><option value="inclusive">PDV je uključen</option><option value="none">Bez PDV-a</option></select></Field>
 <Field label="Važenje ponude"><input maxLength={200} value={draft.validity} onChange={e=>patch({validity:e.target.value})}/></Field><Field label="Način plaćanja"><input maxLength={200} value={draft.payment} onChange={e=>patch({payment:e.target.value})}/></Field><Field label="Rok isporuke"><input maxLength={300} value={draft.delivery} onChange={e=>patch({delivery:e.target.value})}/></Field></div>
 <h2>Detaljan način obračuna</h2>{draft.positions.map((p,i)=><details className="element-breakdown" key={p.id}><summary>{p.name}</summary>{c.positions[i].lines.map((line,k)=><div key={k}><span>{line.name}<small>{line.basis}</small></span><strong>{euro(line.amount)}</strong></div>)}{p.manualPrice!==null&&<p>Ručna cena: {euro(p.manualPrice)} / kom.</p>}</details>)}</div></details>
 </main><footer className="field-bottom-actions correction-save"><div className="correction-sticky-total"><span>{manual?'Ručna ukupna cena':c.hasUnpriced?'Zbir poznatih stavki':'Okvirna cena'}</span><strong>{euro(c.total)}</strong></div>{message&&<span aria-live="polite">{message}</span>}<Link className="field-button field-button-light" to={`/posao/${job.id}`}>Nazad na posao</Link><button type="submit" className="field-button field-button-yellow"><Check/>Sačuvaj cenu</button></footer></form></div>;
}
