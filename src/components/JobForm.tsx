import { useState } from 'react';
import { ArrowRight, UserRound, MapPin, ClipboardList } from 'lucide-react';
import type { Job } from '../models';
import { Button, Field, Modal } from './UI';
export function JobForm({job,onSave,onClose,isNew=false}:{job:Job;onSave:(j:Job)=>void;onClose:()=>void;isNew?:boolean}) {
 const [draft,setDraft]=useState<Job>(structuredClone(job));
 const customer=(key:keyof Job['customer'],value:string)=>setDraft({...draft,customer:{...draft.customer,[key]:value}});
 return <Modal title={isNew?'Nov posao, novi prostor.':'Podaci o poslu'} onClose={onClose} wide><form onSubmit={e=>{e.preventDefault();onSave({...draft,date:draft.date||job.date});}} className="job-form">
  <p className="muted">{isNew?'Unesite osnovne podatke. Mere i elemente dodajete u sledećem koraku.':draft.id}</p>
  <h3><UserRound size={17}/> Podaci o kupcu</h3><div className="form-grid">
  <Field label="Ime i prezime / naziv kupca"><input autoFocus required maxLength={100} value={draft.customer.name} onChange={e=>customer('name',e.target.value)} placeholder="npr. Marko Petrović"/></Field>
  <Field label="Telefon"><input type="tel" maxLength={40} value={draft.customer.phone} onChange={e=>customer('phone',e.target.value)} placeholder="06x xxx xxxx"/></Field>
  <Field label="Email"><input type="email" maxLength={100} value={draft.customer.email} onChange={e=>customer('email',e.target.value)} placeholder="kupac@example.com"/></Field>
  <Field label="Tip objekta"><select value={draft.customer.building} onChange={e=>customer('building',e.target.value)}>{['Porodična kuća','Stan','Poslovni prostor','Drugo'].map(s=><option key={s}>{s}</option>)}</select></Field></div>
  <h3><MapPin size={17}/> Lokacija i merenje</h3><Field label="Adresa objekta"><input maxLength={200} value={draft.customer.address} onChange={e=>customer('address',e.target.value)} placeholder="Ulica, broj i mesto"/></Field>
  <div className="form-grid"><Field label="Datum merenja"><input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></Field><Field label="Majstor"><input maxLength={100} value={draft.technician} onChange={e=>setDraft({...draft,technician:e.target.value})}/></Field></div>
  <Field label="Status posla"><select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Job['status']})}>{['U izradi','Ponuda','Čeka proveru','Završeno'].map(status=><option key={status}>{status}</option>)}</select></Field>
  <h3><ClipboardList size={17}/> Napomene</h3><Field label="Opšte napomene"><textarea maxLength={2000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Dogovor sa kupcem, uslovi na objektu…" rows={3}/></Field>
  <div className="modal-footer"><Button type="button" variant="secondary" onClick={onClose}>Otkaži</Button><Button type="submit">{isNew?'Kreiraj i započni merenje':'Sačuvaj podatke'}<ArrowRight size={17}/></Button></div>
 </form></Modal>;
}
