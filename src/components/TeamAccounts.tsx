import { useEffect, useState, type FormEvent } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { usernameDomain, usernameHint, usernamePattern } from '../../supabase/functions/_shared/team-login';
import { changeTeamAccount, fetchTeamAccounts, type TeamAccount, type TeamMember } from '../services/team-api';
import { Field, Modal } from './UI';

const loadError = 'Lista korisnika trenutno nije dostupna.';

export function TeamAccounts({member}: {member:TeamMember}){
 const [accounts,setAccounts]=useState<TeamAccount[]|null>(null);
 const [reload,setReload]=useState(0);
 const [listError,setListError]=useState('');
 const [feedback,setFeedback]=useState('');
 const [creating,setCreating]=useState(false);
 const [formError,setFormError]=useState('');
 const [deleting,setDeleting]=useState<TeamAccount|null>(null);
 const [busyDelete,setBusyDelete]=useState(false);
 const [deleteError,setDeleteError]=useState('');

 useEffect(()=>{
  let current=true;
  void fetchTeamAccounts().then(list=>{
   if(current){setAccounts(list);setListError('');}
  }).catch(()=>{if(current)setListError(loadError);});
  return ()=>{current=false;};
 },[reload,member.id]);

 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(creating)return;
  const form=event.currentTarget,data=new FormData(form);
  const identifier=String(data.get('identifier')??'').trim();
  const name=String(data.get('name')??'').trim();
  const password=String(data.get('password')??'');
  setFeedback('');
  if(!identifier.includes('@')&&!usernamePattern.test(identifier.toLowerCase())){setFormError(usernameHint);return;}
  setFormError('');
  setCreating(true);
  try{
   await changeTeamAccount({action:'create',identifier,name,password});
   form.reset();
   setFeedback(`Nalog za ${name} je napravljen.`);
   setReload(value=>value+1);
  }catch(error){setFormError((error as Error).message);}
  finally{setCreating(false);}
 }

 async function remove(){
  if(!deleting||busyDelete)return;
  setFeedback('');
  setDeleteError('');
  setBusyDelete(true);
  try{
   await changeTeamAccount({action:'delete',id:deleting.id});
   setAccounts(previous=>previous?.filter(account=>account.id!==deleting.id)??null);
   setFeedback(`Nalog za ${deleting.name} je obrisan.`);
   setDeleting(null);
  }catch(error){setDeleteError((error as Error).message);}
  finally{setBusyDelete(false);setReload(value=>value+1);}
 }

 return <div className="team-accounts">
  <section aria-labelledby="new-team-account">
   <h2 id="new-team-account">Dodaj korisnika</h2>
   <p className="settings-note">Novi nalog ima ulogu majstora.</p>
   <form className="settings-fields" onSubmit={create}>
    <Field label="Korisničko ime ili e-mail"><input name="identifier" required maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={creating}/></Field>
    <Field label="Ime i prezime"><input name="name" required maxLength={100} autoComplete="off" disabled={creating}/></Field>
    <Field label="Lozinka" hint="Najmanje 8 znakova."><input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" disabled={creating}/></Field>
    <button type="submit" className="field-button field-button-yellow team-account-create" disabled={creating}><UserPlus/>{creating?'Dodajem…':'Dodaj korisnika'}</button>
    {formError&&<p className="team-error team-account-feedback" role="alert">{formError}</p>}
   </form>
  </section>
  <section aria-labelledby="existing-team-accounts">
   <h2 id="existing-team-accounts">Svi korisnici</h2>
   {feedback&&<p className="field-message" role="status">{feedback}</p>}
   {listError&&<div className="team-actions"><p className="team-error" role="alert">{listError}</p><button className="field-button field-button-light" onClick={()=>{setListError('');setReload(value=>value+1);}}>Pokušaj ponovo</button></div>}
   {!accounts&&!listError&&<p role="status">Učitavanje korisnika…</p>}
   {accounts?.length===0&&<p>Nema korisnika.</p>}
   {Boolean(accounts?.length)&&<ul className="team-account-list">{accounts?.map(account=><li key={account.id}>
    <div><strong>{account.name}</strong><span>{account.email?.endsWith(usernameDomain)?account.email.slice(0,-usernameDomain.length):account.email}</span></div>
    <div><span>{account.role==='manager'?'Administrator':'Majstor'}{account.id===member.id?' · Vaš nalog':''}{account.active?'':' · Pristup ukinut'}</span>
     {account.id!==member.id&&<button type="button" className="field-button field-button-light" aria-label={`Obriši nalog za ${account.name}`}
      onClick={()=>{setDeleteError('');setDeleting(account);}}><Trash2 size={17}/>Obriši</button>}
    </div>
   </li>)}</ul>}
  </section>
  {deleting&&<Modal title="Obriši nalog?" onClose={()=>{if(!busyDelete)setDeleting(null);}}>
   <p>Korisnik {deleting.name} gubi pristup aplikaciji. Poslovi i poruke ostaju sačuvani.</p>
   {deleteError&&<p className="team-error" role="alert">{deleteError}</p>}
   <div className="modal-footer">
    <button type="button" className="field-button field-button-light" disabled={busyDelete} onClick={()=>setDeleting(null)}>Otkaži</button>
    <button type="button" className="field-button field-button-red" disabled={busyDelete} onClick={()=>void remove()}>{busyDelete?'Brišem…':'Obriši nalog'}</button>
   </div>
  </Modal>}
 </div>;
}
