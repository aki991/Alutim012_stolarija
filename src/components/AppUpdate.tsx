import { useState, useSyncExternalStore } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { applyAppUpdate, hasAppUpdate, subscribeToAppUpdate } from '../offline';
import './app-update.css';

export function AppUpdate() {
 const available = useSyncExternalStore(subscribeToAppUpdate, hasAppUpdate);
 const [dismissed, setDismissed] = useState(false);
 if (!available || dismissed) return null;

 return <aside className="app-update" aria-label="Ažuriranje aplikacije">
  <p role="status"><strong>Dostupna je nova verzija.</strong><br/>Sačuvajte trenutne izmene pre osvežavanja.</p>
  <button className="app-update-apply" type="button" onClick={applyAppUpdate}><RefreshCw size={16} aria-hidden="true"/>Ažuriraj</button>
  <button className="app-update-dismiss" type="button" aria-label="Ažuriraj kasnije" onClick={() => setDismissed(true)}><X size={18} aria-hidden="true"/></button>
 </aside>;
}
