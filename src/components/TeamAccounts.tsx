import { useEffect, useId, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Pencil, Trash2, UserPlus } from 'lucide-react';
import { canChangeLoginIdentifier, usernameDomain, usernameHint, usernamePattern } from '../../supabase/functions/_shared/team-login';
import { renameWorkspaceMember } from '../store';
import { changeTeamAccount, fetchTeamAccounts, type TeamAccount, type TeamMember } from '../services/team-api';
import { Field, Modal } from './UI';

const loadError = 'Lista korisnika trenutno nije dostupna.';
const roleLabels = { admin: 'Admin', manager: 'Šef', worker: 'Majstor' };
const loginIdentifier = (email: string | null) => email?.endsWith(usernameDomain) ? email.slice(0, -usernameDomain.length) : email ?? '';

function EditAccount({ account, isAdmin, onClose, onSaved }: {
 account: TeamAccount; isAdmin: boolean; onClose: () => void; onSaved: (name: string) => void;
}) {
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const editableIdentifier = canChangeLoginIdentifier(isAdmin, account.email);
 const originalIdentifier = loginIdentifier(account.email);

 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (busy) return;
  const data = new FormData(event.currentTarget);
  const name = String(data.get('name') ?? '').trim();
  const identifier = String(data.get('identifier') ?? '').trim().toLowerCase();
  setError('');
  setBusy(true);
  try {
   await changeTeamAccount({
    action: 'update', id: account.id, name,
    ...(editableIdentifier && identifier !== originalIdentifier ? { identifier } : {}),
   });
   renameWorkspaceMember(account.id, name);
   onSaved(name);
  } catch (failure) {
   setError((failure as Error).message);
  } finally { setBusy(false); }
 }

 return <Modal title="Uredi profil" onClose={() => { if (!busy) onClose(); }}>
  <form className="settings-fields team-profile-form" onSubmit={submit}>
   <Field label="Ime i prezime"><input name="name" defaultValue={account.name} required maxLength={100} disabled={busy}/></Field>
   <Field label="Korisničko ime ili e-mail" hint={editableIdentifier ? undefined : 'Stvarnu e-mail adresu može da promeni samo admin.'}>
    <input name="identifier" defaultValue={originalIdentifier} readOnly={!editableIdentifier} disabled={busy} maxLength={254}
     autoComplete="off" autoCapitalize="none" spellCheck={false}/>
   </Field>
   {error && <p className="team-error" role="alert">{error}</p>}
   <div className="modal-footer">
    <button type="button" className="field-button field-button-light" disabled={busy} onClick={onClose}>Otkaži</button>
    <button type="submit" className="field-button field-button-yellow" disabled={busy}>{busy ? 'Čuvam…' : 'Sačuvaj profil'}</button>
   </div>
  </form>
 </Modal>;
}

export function TeamAccounts({member}: {member:TeamMember}){
 const [accounts,setAccounts]=useState<TeamAccount[]|null>(null);
 const [reload,setReload]=useState(0);
 const [listError,setListError]=useState('');
 const [feedback,setFeedback]=useState('');
 const [creating,setCreating]=useState(false);
 const [existingAccount,setExistingAccount]=useState(false);
 const [showPassword,setShowPassword]=useState(false);
 const passwordId=useId();
 const [formError,setFormError]=useState('');
 const [editing,setEditing]=useState<TeamAccount|null>(null);
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

 async function addAccount(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(creating)return;
  const form=event.currentTarget,data=new FormData(form);
  const identifier=String(data.get('identifier')??'').trim();
  const name=String(data.get('name')??'').trim();
  const password=String(data.get('password')??'');
  const role=data.get('role')==='manager'?'manager':'worker';
  setFeedback('');
  if(!identifier.includes('@')&&!usernamePattern.test(identifier.toLowerCase())){setFormError(usernameHint);return;}
  setFormError('');
  setCreating(true);
  try{
   await changeTeamAccount(existingAccount?{action:'link',identifier,role}:{action:'create',identifier,name,password,role});
   form.reset();
   setShowPassword(false);
   setFeedback(existingAccount?`Nalog ${identifier} ima pristup Stolariji.`:`Nalog za ${name} je napravljen.`);
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
   <label className="team-account-mode"><input type="checkbox" checked={existingAccount} disabled={creating} onChange={event=>{
    setExistingAccount(event.target.checked);setShowPassword(false);setFormError('');
   }}/>Postojeći nalog</label>
   {existingAccount&&<p className="settings-note">Korisnik nastavlja da se prijavljuje istim korisničkim imenom i lozinkom.</p>}
   <form className="settings-fields" onSubmit={addAccount}>
    <Field label="Korisničko ime ili e-mail"><input name="identifier" required maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={creating}/></Field>
    <Field label="Uloga"><select name="role" disabled={creating} defaultValue="worker">
     <option value="worker">Majstor</option><option value="manager">Šef</option>
    </select></Field>
    {!existingAccount&&<>
    <Field label="Ime i prezime"><input name="name" required maxLength={100} autoComplete="off" disabled={creating}/></Field>
    <div className="field">
     <span><label htmlFor={passwordId}>Lozinka</label></span>
     <div className="team-account-password">
      <input id={passwordId} name="password" type={showPassword?'text':'password'} required minLength={8} maxLength={72}
       autoComplete="new-password" autoCapitalize="none" spellCheck={false} disabled={creating} aria-describedby={`${passwordId}-hint`}/>
      <button type="button" disabled={creating} aria-label={showPassword?'Sakrij lozinku':'Prikaži lozinku'} aria-controls={passwordId}
       onClick={()=>setShowPassword(visible=>!visible)}>{showPassword?<EyeOff size={21} aria-hidden="true"/>:<Eye size={21} aria-hidden="true"/>}</button>
     </div>
     <small id={`${passwordId}-hint`}>Najmanje 8 znakova.</small>
    </div>
    </>}
    <button type="submit" className="field-button field-button-yellow team-account-create" disabled={creating}><UserPlus/>{creating?'Dodajem…':existingAccount?'Dodeli pristup':'Dodaj korisnika'}</button>
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
    <div><strong>{account.name}</strong><span>{loginIdentifier(account.email)}</span></div>
    <div><span>{roleLabels[account.role]}{account.id===member.id?' · Vaš nalog':''}{account.active?'':' · Pristup ukinut'}</span>
     <button type="button" className="field-button field-button-light" aria-label={`Uredi profil za ${account.name}`} onClick={()=>setEditing(account)}>
      <Pencil size={17} aria-hidden="true"/>Uredi
     </button>
     {account.id!==member.id&&account.role!=='admin'&&<button type="button" className="field-button field-button-light" aria-label={`Obriši nalog za ${account.name}`}
      onClick={()=>{setDeleteError('');setDeleting(account);}}><Trash2 size={17}/>Obriši</button>}
    </div>
   </li>)}</ul>}
  </section>
  {editing&&<EditAccount account={editing} isAdmin={Boolean(member.is_admin)} onClose={()=>setEditing(null)} onSaved={name=>{
   setFeedback(`Profil za ${name} je sačuvan.`);
   setEditing(null);
   setReload(value=>value+1);
  }}/>}
  {deleting&&<Modal title="Obriši nalog?" onClose={()=>{if(!busyDelete)setDeleting(null);}}>
   <p>Brisanjem zajedničkog naloga korisnik {deleting.name} gubi mogućnost prijave u Stolariju i Ograde. Poslovi i poruke ostaju sačuvani.</p>
   {deleteError&&<p className="team-error" role="alert">{deleteError}</p>}
   <div className="modal-footer">
    <button type="button" className="field-button field-button-light" disabled={busyDelete} onClick={()=>setDeleting(null)}>Otkaži</button>
    <button type="button" className="field-button field-button-red" disabled={busyDelete} onClick={()=>void remove()}>{busyDelete?'Brišem…':'Obriši nalog'}</button>
   </div>
  </Modal>}
 </div>;
}
