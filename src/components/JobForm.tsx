import { useState } from 'react';
import { Check, Phone, Mail } from 'lucide-react';
import type { Job } from '../models';
import { Button, Field, Modal } from './UI';
import { JobStatus } from './JobStatus';
export function JobForm({job,onSave,onClose,isNew=false}:{job:Job;onSave:(j:Job)=>void;onClose:()=>void;isNew?:boolean}) {
 const [draft,setDraft]=useState<Job>(structuredClone(job));
 const customer=(key:keyof Job['customer'],value:string)=>setDraft({...draft,customer:{...draft.customer,[key]:value}});
 return <Modal title={isNew?'Nov posao':'Podaci o kupcu'} onClose={onClose} wide><form onSubmit={e=>{e.preventDefault();if(draft.customer.name.trim())onSave({...draft,customer:{...draft.customer,name:draft.customer.name.trim()}});}} className="job-form customer-form">
  <section className="customer-section"><h3>Kupac</h3>
   <Field label="Naziv kupca"><input autoFocus required maxLength={100} value={draft.customer.name} onChange={e=>customer('name',e.target.value)}/></Field>
   <div className="customer-contacts"><div><Field label="Telefon"><input type="tel" maxLength={40} value={draft.customer.phone} onChange={e=>customer('phone',e.target.value)}/></Field>{draft.customer.phone&&<a className="contact-link" href={`tel:${draft.customer.phone.replace(/[^+0-9]/g,'')}`}><Phone size={19}/>Pozovi</a>}</div>
   <div><Field label="Email"><input type="email" maxLength={100} value={draft.customer.email} onChange={e=>customer('email',e.target.value)}/></Field>{draft.customer.email&&<a className="contact-link" href={`mailto:${draft.customer.email}`}><Mail size={19}/>Pošalji email</a>}</div></div>
   <Field label="Adresa objekta"><input maxLength={200} value={draft.customer.address} onChange={e=>customer('address',e.target.value)}/></Field>
  </section>
  <section className="customer-section customer-status"><h3>Status posla</h3><JobStatus value={draft.status} onChange={status=>setDraft({...draft,status})}/></section>
  <details className="customer-section"><summary>Dodatni podaci</summary><div className="form-grid">
   <Field label="Datum merenja"><input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></Field>
   <Field label="Majstor"><input maxLength={100} value={draft.technician} onChange={e=>setDraft({...draft,technician:e.target.value})}/></Field>
   <Field label="Tip objekta"><select value={draft.customer.building} onChange={e=>customer('building',e.target.value)}>{['','Porodična kuća','Stan','Poslovni prostor','Drugo'].map(s=><option key={s} value={s}>{s||'Nije navedeno'}</option>)}</select></Field>
  </div></details>
  <section className="customer-section"><h3>Napomene</h3><Field label="Opšte napomene"><textarea maxLength={2000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Dogovor sa kupcem, uslovi na objektu…" rows={3}/></Field></section>
  <div className="modal-footer"><Button type="button" variant="secondary" onClick={onClose}>Otkaži</Button><Button type="submit"><Check/>{isNew?'Kreiraj i započni merenje':'Sačuvaj podatke'}</Button></div>
 </form></Modal>;
}
