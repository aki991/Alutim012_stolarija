import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getSupabase } from '../services/supabase';

const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function saveSubscription(subscription: PushSubscription, enable: boolean) {
 const keys = subscription.toJSON().keys;
 const { error } = await getSupabase().rpc('field_team_push_device', {
  p_endpoint: subscription.endpoint, p_p256dh: enable ? keys?.p256dh : null, p_auth: enable ? keys?.auth : null,
 });
 if (error) throw error;
}

export async function removeDeviceNotifications() {
 if (!supported) return;
 const registration = await navigator.serviceWorker.getRegistration();
 const subscription = await registration?.pushManager.getSubscription();
 if (!subscription) return;
 await subscription.unsubscribe();
 await saveSubscription(subscription, false);
}

export function DeviceNotifications() {
 const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
 const [subscription, setSubscription] = useState<PushSubscription | null>(null);
 const [key, setKey] = useState('');
 const [enabled, setEnabled] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');

 useEffect(() => {
  if (!supported) return;
  let active = true;
  async function load() {
   const worker = await navigator.serviceWorker.ready;
   const subscription = await worker.pushManager.getSubscription();
   const api = getSupabase();
   const [publicKey, status] = await Promise.all([
    api.rpc('field_team_push_key'),
    subscription ? api.rpc('field_team_push_enabled', { p_endpoint: subscription.endpoint }) : null,
   ]);
   if (publicKey.error || status?.error || !publicKey.data) throw new Error('Push setup unavailable');
   if (active) {
    setRegistration(worker);
    setSubscription(subscription);
    setKey(publicKey.data);
    setEnabled(Boolean(status?.data) && Notification.permission === 'granted');
   }
  }
  void load().catch(() => { if (active) setError('Obaveštenja na uređaju trenutno nisu dostupna.'); });
  return () => { active = false; };
 }, []);

 async function toggle() {
  if (!registration || !key || busy) return;
  setBusy(true);
  setError('');
  try {
   if (enabled) {
    await removeDeviceNotifications();
    setSubscription(null);
    setEnabled(false);
   } else {
    if (Notification.permission === 'denied') {
     setError('Dozvolite obaveštenja za aplikaciju u podešavanjima pregledača ili uređaja.');
     return;
    }
    const current = subscription ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    setSubscription(current);
    await saveSubscription(current, true);
    setEnabled(true);
   }
  } catch {
   setError(Notification.permission === 'denied'
    ? 'Dozvolite obaveštenja za aplikaciju u podešavanjima pregledača ili uređaja.'
    : 'Podešavanje obaveštenja nije uspelo. Proverite vezu i pokušajte ponovo.');
  }
  finally { setBusy(false); }
 }

 return <section className="team-card team-device-notifications">
  <h2><Bell size={20}/>Obaveštenja na uređaju</h2>
  <p>{enabled ? 'Uključena su za poruke i obaveštenja i kad je aplikacija zatvorena.' : 'Primajte poruke i obaveštenja i kad je aplikacija zatvorena.'}</p>
  {supported ? <button type="button" className="field-button field-button-light" disabled={!key || busy} onClick={() => void toggle()}>
   {enabled ? 'Isključi na ovom uređaju' : 'Uključi na ovom uređaju'}
  </button> : <p>Na iPhone-u i iPad-u dodajte aplikaciju na početni ekran i otvorite je odatle. Na drugim uređajima koristite pregledač koji podržava sistemska obaveštenja.</p>}
  {error && <p className="team-error" role="alert">{error}</p>}
 </section>;
}
