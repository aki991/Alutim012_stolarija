import { useState, type FormEvent } from 'react';
import { changeOwnPassword } from '../services/supabase';
import { Field, Modal } from './UI';

export function ChangePassword({ memberId, onClose, onSaved }: { memberId: string; onClose: () => void; onSaved: () => void }) {
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (busy) return;
  const data = new FormData(event.currentTarget);
  const current = String(data.get('current') ?? '');
  const password = String(data.get('password') ?? '');
  if (password !== data.get('confirmation')) {
   setError('Nova lozinka i potvrda moraju biti iste.');
   return;
  }
  if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
   setError('Nova lozinka mora imati najmanje 8 znakova i najviše 72 bajta.');
   return;
  }
  if (current === password) {
   setError('Nova lozinka mora da se razlikuje od trenutne.');
   return;
  }
  setError('');
  setBusy(true);
  try {
   await changeOwnPassword(memberId, current, password);
   onSaved();
  } catch (failure) {
   setError((failure as Error).message);
  } finally { setBusy(false); }
 }

 return <Modal title="Promeni lozinku" onClose={() => { if (!busy) onClose(); }}>
  <form className="settings-fields team-profile-form" onSubmit={submit}>
   <Field label="Trenutna lozinka"><input name="current" type="password" autoComplete="current-password" required disabled={busy}/></Field>
   <Field label="Nova lozinka" hint="Najmanje 8 znakova."><input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required disabled={busy}/></Field>
   <Field label="Potvrdi novu lozinku"><input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} required disabled={busy}/></Field>
   {error && <p className="team-error" role="alert">{error}</p>}
   <div className="modal-footer">
    <button type="button" className="field-button field-button-light" onClick={onClose} disabled={busy}>Otkaži</button>
    <button type="submit" className="field-button field-button-yellow" disabled={busy}>{busy ? 'Čuvam…' : 'Sačuvaj lozinku'}</button>
   </div>
  </form>
 </Modal>;
}
