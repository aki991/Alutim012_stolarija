import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Field, Modal } from './UI';
export function NewJobDialog({onCreate,onClose,submitLabel='Započni merenje'}:{onCreate:(name:string)=>void;onClose:()=>void;submitLabel?:string}){
 const [name,setName]=useState('');
 return <Modal title="Novi posao" onClose={onClose}><form className="quick-job-form" onSubmit={event=>{event.preventDefault();if(name.trim())onCreate(name.trim());}}>
  <Field label="Naziv posla ili prezime kupca"><input required autoFocus maxLength={100} autoComplete="off" placeholder="Petrović" value={name} onChange={event=>setName(event.target.value)}/></Field>
  <Button type="submit" disabled={!name.trim()}>{submitLabel} <ArrowRight size={24}/></Button>
 </form></Modal>;
}
