import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LogIn, WifiOff } from 'lucide-react';
import { beginTeamWorkspace, endTeamWorkspace, findLocalJob, refreshTeamWorkspace, renameWorkspaceMember, useStore } from './store';
import { fetchTeamConversations, fetchTeamMember, fetchTeamMessageNotices, fetchTeamNotifications, markTeamMessagesRead, markTeamNotificationRead, type TeamConversation, type TeamNotification } from './services/team-api';
import { getSupabase, isSupabaseConfigured } from './services/supabase';
import { removeDeviceNotifications } from './components/DeviceNotifications';
import { loginEmail, usernameHint, usernamePattern } from '../supabase/functions/_shared/team-login';
import { offlineJobTransferPath } from './services/offline-job-transfer';

const teamLoginRequired = (import.meta.env.PROD && import.meta.env.MODE !== 'test') ||
 import.meta.env.VITE_TEAM_LOGIN_REQUIRED === 'true';
const offlineModeKey = 'alu-offline-mode-v1';
const teamOnlyPath = /^\/(tim|nalog|poruke|obavestenja|dodeli-merenje|prebaci-u-tim)(\/|$)/;
const OfflineWork = createContext({ offline: false, openOffline: () => {} });
export const useOfflineWork = () => useContext(OfflineWork);
const TeamInbox = createContext({ items: [] as TeamNotification[], messageAlerts: [] as TeamConversation[], error: '', markRead: async (_id: string) => {},
 conversations: [] as TeamConversation[], messagesError: '', readMessages: async (_jobId: string, _messageId: string) => {}, refreshMessages: () => {} });
export const useTeamInbox = () => useContext(TeamInbox);
export const teamNotificationLabels = { assignment: 'Dodeljeno merenje', status: 'Promena statusa' };

export function pollTeam(refresh: (isCurrent: () => boolean) => Promise<void>) {
 let current = true, loading = false;
 const tick = async () => {
  if (loading) return;
  loading = true;
  try { await refresh(() => current); }
  finally { loading = false; }
 };
 void tick();
 const timer = window.setInterval(tick, 5000);
 const onVisibilityChange = () => { if (document.visibilityState === 'visible') void tick(); };
 document.addEventListener('visibilitychange', onVisibilityChange);
 window.addEventListener('focus', tick);
 window.addEventListener('online', tick);
 return () => {
  current = false;
  clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('focus', tick);
  window.removeEventListener('online', tick);
 };
}

function TeamInboxProvider({ children }: { children: ReactNode }) {
 const [items, setItems] = useState<TeamNotification[]>([]);
 const [error, setError] = useState('');
 const [conversations, setConversations] = useState<TeamConversation[]>([]);
 const [messageNotices, setMessageNotices] = useState<Awaited<ReturnType<typeof fetchTeamMessageNotices>>>([]);
 const [messagesError, setMessagesError] = useState('');
 const [messagesRevision, setMessagesRevision] = useState(0);
 useEffect(() => pollTeam(async isCurrent => {
  void refreshTeamWorkspace();
  try {
   const [next, notices] = await Promise.all([fetchTeamNotifications(), fetchTeamMessageNotices()]);
   if (!isCurrent()) return;
   setMessageNotices(notices);
   setItems(previous => {
    const read = new Map(previous.filter(item => item.read_at).map(item => [item.id, item.read_at]));
    return next.map(item => ({ ...item, read_at: item.read_at ?? read.get(item.id) ?? null }));
   });
   setError('');
  } catch { if (isCurrent()) setError('Obaveštenja trenutno nisu dostupna.'); }
 }), []);
 useEffect(() => pollTeam(async isCurrent => {
  try {
   const next = await fetchTeamConversations();
   if (!isCurrent()) return;
   setConversations(previous => {
    const read = new Set(previous.filter(item => !item.unread).map(item => item.id));
    return next.map(item => read.has(item.id) ? { ...item, unread: false } : item);
   });
   setMessagesError('');
  } catch { if (isCurrent()) setMessagesError('Razgovori trenutno nisu dostupni.'); }
 }), [messagesRevision]);
 async function markRead(id: string) {
  await markTeamNotificationRead(id);
  setItems(previous => previous.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
 }
 const readMessages = useCallback(async (jobId: string, messageId: string) => {
  await markTeamMessagesRead(jobId, messageId);
  setConversations(previous => previous.map(item => item.job_id === jobId && item.id === messageId ? { ...item, unread: false } : item));
 }, []);
 const refreshMessages = useCallback(() => setMessagesRevision(revision => revision + 1), []);
 const messageAlerts = conversations.filter(message => message.unread && messageNotices.some(item =>
  item.job_id === message.job_id && item.created_at === message.created_at && item.body === message.body));
 return <TeamInbox.Provider value={{ items, messageAlerts, error, markRead, conversations, messagesError, readMessages, refreshMessages }}>{children}</TeamInbox.Provider>;
}

export function TeamGate({ children }: { children: ReactNode }) {
 const location = useLocation();
 const navigate = useNavigate();
 const member = useStore(state => state.teamMember);
 const [offlineMode, setOfflineMode] = useState(() => {
  try { return localStorage.getItem(offlineModeKey) === 'true'; }
  catch { return false; }
 });
 const [resumeOnline, setResumeOnline] = useState(() => offlineMode && navigator.onLine);
 const loginPath = /^\/prijava\/?$/.test(location.pathname);
 const startingOffline = location.pathname === '/radi-bez-interneta';
 const resumingTeam = offlineMode && resumeOnline && !startingOffline;
 const offline = startingOffline || (offlineMode && !loginPath && !resumingTeam);
 const selectMode = useCallback((value: boolean) => {
  try {
   if (value) localStorage.setItem(offlineModeKey, 'true');
   else localStorage.removeItem(offlineModeKey);
  } catch { /* The selected mode still works in the open app. */ }
  setOfflineMode(value);
 }, []);
 const onTeamReady = useCallback(() => selectMode(false), [selectMode]);
 const openOffline = () => navigate('/radi-bez-interneta', {
  replace: true, state: { localJobId: location.state?.localJobId },
 });

 useLayoutEffect(() => {
  if (offline) endTeamWorkspace();
  if (startingOffline) {
   setResumeOnline(false);
   selectMode(true);
  }
 }, [member, offline, selectMode, startingOffline]);
 useEffect(() => {
  if (!offline || startingOffline) return;
  const resume = () => {
   if (document.visibilityState === 'visible' && navigator.onLine) setResumeOnline(true);
  };
  document.addEventListener('visibilitychange', resume);
  return () => document.removeEventListener('visibilitychange', resume);
 }, [offline, startingOffline]);

 const localJobId = startingOffline && typeof location.state?.localJobId === 'string' ? location.state.localJobId : null;
 const localDestination = localJobId && findLocalJob(localJobId) ? `/posao/${encodeURIComponent(localJobId)}` : '/poslovi';
 let screen: ReactNode;
 if (resumingTeam && (!loginPath || !location.state?.from)) {
  screen = <Navigate to="/prijava" state={{ from: '/poslovi' }} replace/>;
 } else if (offline) {
  const redirect = startingOffline || teamOnlyPath.test(location.pathname);
  screen = member ? null : redirect ? <Navigate to={localDestination} replace/> : children;
 } else {
  screen = <TeamSession loginPath={loginPath} onTeamReady={onTeamReady}>{children}</TeamSession>;
 }
 return <OfflineWork.Provider value={{ offline, openOffline }}>{screen}</OfflineWork.Provider>;
}

function TeamSession({ children, loginPath, onTeamReady }: { children: ReactNode; loginPath: boolean; onTeamReady: () => void }) {
 const location = useLocation();
 const member = useStore(state => state.teamMember);
 const [userId, setUserId] = useState<string | null | undefined>(isSupabaseConfigured ? undefined : null);
 const [profile, setProfile] = useState<{ id: string; error: string } | null>(null);
 const [retry, setRetry] = useState(0);

 useEffect(() => {
  if (!isSupabaseConfigured) return;
  const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_event, session) => {
   setUserId(session?.user.id ?? null);
  });
  return () => subscription.unsubscribe();
 }, []);

 useEffect(() => {
  let active = true;
  setProfile(null);
  if (!userId) { endTeamWorkspace(); return; }
  if (useStore.getState().teamMember?.id !== userId) endTeamWorkspace();
  async function loadProfile(id: string) {
   try {
    const teamMember = await fetchTeamMember(id);
    if (!active) return;
    if (!teamMember?.active) {
     endTeamWorkspace();
     setProfile({ id, error: 'Nalog još nema pristup timu. Obratite se administratoru.' });
     return;
    }
    await beginTeamWorkspace(teamMember);
    if (active) {
     onTeamReady();
     setProfile({ id, error: '' });
    }
   } catch {
    if (active) setProfile({ id, error: 'Podaci o nalogu trenutno nisu dostupni. Proverite vezu i pokušajte ponovo.' });
   }
  }
  void loadProfile(userId);
  return () => { active = false; };
 }, [onTeamReady, userId, retry]);

 const activeProfileId = profile && !profile.error ? profile.id : null;
 useEffect(() => {
  if (!activeProfileId || activeProfileId !== userId) return;
  return pollTeam(async isCurrent => {
   try {
    const current = await fetchTeamMember(activeProfileId);
    if (!isCurrent()) return;
    if (!current?.active) {
     endTeamWorkspace();
     setProfile({ id: activeProfileId, error: 'Nalog nema pristup timu. Obratite se administratoru.' });
    } else {
     const previous=useStore.getState().teamMember;
     if(previous?.role!==current.role||Boolean(previous.is_admin)!==Boolean(current.is_admin)){
      endTeamWorkspace();
      await beginTeamWorkspace(current);
     } else renameWorkspaceMember(current.id, current.name);
    }
   } catch { /* A temporary connection failure does not revoke the session. */ }
  });
 }, [activeProfileId, userId]);

 if (userId === undefined || (userId && profile?.id !== userId) || (!userId && member)) {
  return <TeamStartup/>;
 }
 if (userId && profile?.error) return <AccountError message={profile.error} onRetry={() => { setProfile(null); setRetry(n => n + 1); }}/>;
 if (userId && member?.id === userId) {
  const requested = location.state?.from;
  const destination = typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//') ? requested : '/obavestenja';
  const transferState = destination === offlineJobTransferPath ? { localJobId: location.state?.localJobId } : undefined;
  return <TeamInboxProvider key={userId}>{loginPath ? <Navigate to={destination} state={transferState} replace/> : children}</TeamInboxProvider>;
 }
 if (loginPath) return <Login/>;
 if (teamLoginRequired || teamOnlyPath.test(location.pathname)) return <Navigate to="/prijava" state={{ from: location.pathname + location.search + location.hash }} replace/>;
 return children;
}

function subscribeToConnection(listener: () => void) {
 window.addEventListener('online', listener);
 window.addEventListener('offline', listener);
 return () => {
  window.removeEventListener('online', listener);
  window.removeEventListener('offline', listener);
 };
}

function TeamStartup() {
 const online = useSyncExternalStore(subscribeToConnection, () => navigator.onLine);
 if (!online) {
  return <LoginFrame><h1>Nema internet veze</h1><OfflineWorkButton/></LoginFrame>;
 }
 return <main className="team-startup">
  <p role="status"><Loader2 className="team-login-spinner" size={20} aria-hidden="true"/>Učitavanje aplikacije…</p>
 </main>;
}

function LoginFrame({ children, homeLink = false }: { children: ReactNode; homeLink?: boolean }) {
 return <main className="team-login"><div className="team-login-layout">
  <img className="team-login-logo" src="/assets/login-logo.png" width={150} height={150} alt="ALU TIM 012" draggable={false}/>
  <section className="team-login-card">{children}</section>
  {homeLink && <Link className="team-login-back" to="/">Vrati se na početnu</Link>}
 </div></main>;
}

function OfflineWorkButton() {
 const { openOffline } = useOfflineWork();
 return <>
  <button type="button" className="team-login-offline" onClick={openOffline}><WifiOff size={18} aria-hidden="true"/>Radi bez interneta</button>
  <p className="team-login-note">Poslovi iz ovog režima čuvaju se na ovom uređaju.</p>
 </>;
}

function Login() {
 const { state } = useLocation();
 const transferring = state?.from === offlineJobTransferPath && typeof state.localJobId === 'string';
 const [identifier, setIdentifier] = useState('');
 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (busy || !isSupabaseConfigured) return;
  const login = identifier.trim().toLowerCase();
  if (!login || !password) { setError('Unesite e-mail ili korisničko ime i lozinku.'); return; }
  if (!login.includes('@') && !usernamePattern.test(login)) {
   setError(usernameHint);
   return;
  }
  const email = loginEmail(login);
  setBusy(true);
  setError('');
  try {
   const { error: failure } = await getSupabase().auth.signInWithPassword({ email, password });
   if (!failure) return;
   setPassword('');
   if (failure.name === 'AuthRetryableFetchError' || !navigator.onLine) {
    setError('Nema veze sa serverom. Proverite internet vezu i pokušajte ponovo.');
   } else if (failure.status === 429) setError('Previše pokušaja prijave. Sačekajte nekoliko minuta pa pokušajte ponovo.');
   else if (failure.code === 'email_not_confirmed') setError('Adresa za prijavu još nije potvrđena. Obratite se administratoru.');
   else if (failure.code === 'user_banned') setError('Ovaj nalog je blokiran. Obratite se administratoru.');
   else if (failure.status === 400 || failure.status === 422) setError('Proverite e-mail ili korisničko ime i lozinku.');
   else setError('Prijava trenutno nije dostupna. Pokušajte ponovo.');
  } catch {
   setError('Prijava trenutno nije dostupna. Pokušajte ponovo.');
  } finally { setBusy(false); }
 }
 return <LoginFrame homeLink={!teamLoginRequired}><h1>Prijava</h1>
  <p className="team-login-subtitle">{transferring ? 'Prijavite se da biste prebacili izabrani posao u tim.' : 'Merenje stolarije i izrada ponuda'}</p>
  {!isSupabaseConfigured && <p className="team-login-alert" role="alert">Prijava zaposlenih zahteva podešenu vezu sa bazom podataka.</p>}
  <form className="team-login-form" onSubmit={submit} noValidate>
   <label htmlFor="team-identifier">E-mail ili korisničko ime</label>
   <input id="team-identifier" type="text" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus required
    disabled={!isSupabaseConfigured} aria-invalid={Boolean(error)} value={identifier} onChange={event => { setIdentifier(event.target.value); setError(''); }}/>
   <label htmlFor="team-password">Lozinka</label>
   <div className="team-login-password">
    <input id="team-password" type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" required
     disabled={!isSupabaseConfigured} aria-invalid={Boolean(error)} value={password} onChange={event => { setPassword(event.target.value); setError(''); }}/>
    <button type="button" disabled={!isSupabaseConfigured} aria-label={showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
     {showPassword ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}
    </button>
   </div>
   {error && <p className="team-login-alert" role="alert">{error}</p>}
   <button type="submit" className="team-login-submit" disabled={busy || !isSupabaseConfigured}>
    {busy ? <Loader2 className="team-login-spinner" size={18} aria-hidden="true"/> : <LogIn size={18} aria-hidden="true"/>}{busy ? 'Prijavljivanje…' : 'Prijavi se'}
   </button>
  </form>
  <p className="team-login-note">Nalog dobijate od administratora.</p>
  <OfflineWorkButton/>
 </LoginFrame>;
}

export async function signOutTeam() {
 await removeDeviceNotifications().catch(() => {});
 const { error } = await getSupabase().auth.signOut({ scope: 'local' });
 if (error) throw error;
}

function AccountError({ message, onRetry }: { message: string; onRetry: () => void }) {
 const [error, setError] = useState('');
 return <LoginFrame><h1>Pristup timu</h1><p role="alert">{message}</p>
  <div className="team-actions"><button className="field-button field-button-red" onClick={onRetry}>Pokušaj ponovo</button>
   <button className="field-button field-button-light" onClick={() => void signOutTeam().catch(() => setError('Odjava trenutno nije uspela.'))}>Odjavi se</button></div>
  <OfflineWorkButton/>
  {error && <p role="alert">{error}</p>}
 </LoginFrame>;
}
