import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Bell, MessageSquare } from 'lucide-react';
import { useStore } from '../store';
import { teamNotificationLabels, useTeamInbox } from '../team-session';

const inboxes = [
 { to: '/obavestenja', label: 'Obaveštenja', action: 'Otvori obaveštenja', empty: 'Nema obaveštenja.', Icon: Bell },
 { to: '/poruke', label: 'Poruke', action: 'Otvori poruke', empty: 'Nema poruka.', Icon: MessageSquare },
] as const;
type InboxPath = (typeof inboxes)[number]['to'];

export function TeamHeaderLinks() {
 const member = useStore(state => state.teamMember);
 const { items, messageAlerts, conversations, error, messagesError } = useTeamInbox();
 const location = useLocation();
 const panelId = useId();
 const nav = useRef<HTMLElement>(null);
 const [open, setOpen] = useState<InboxPath | null>(null);

 useEffect(() => { setOpen(null); }, [location.key]);
 useEffect(() => {
  if (!open) return;
  const dismissOutside = (event: PointerEvent) => {
   if (!nav.current?.contains(event.target as Node)) setOpen(null);
  };
  const dismissOnEscape = (event: KeyboardEvent) => {
   if (event.key !== 'Escape' || event.defaultPrevented) return;
   nav.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
   setOpen(null);
  };
  document.addEventListener('pointerdown', dismissOutside);
  document.addEventListener('keydown', dismissOnEscape);
  return () => {
   document.removeEventListener('pointerdown', dismissOutside);
   document.removeEventListener('keydown', dismissOnEscape);
  };
 }, [open]);

 if (!member) return null;
 const counts = {
  '/obavestenja': items.filter(item => !item.read_at).length + messageAlerts.length,
  '/poruke': conversations.filter(item => item.unread).length,
 };
 const previews = open === '/obavestenja' ? [
  ...items.map(item => ({ id: item.id, title: item.job_name, detail: teamNotificationLabels[item.kind],
   snippet: [item.actor_name, item.body].filter(Boolean).join(' · '), unread: !item.read_at, createdAt: item.created_at })),
  ...messageAlerts.map(item => ({ id: item.id, title: item.job_name, detail: 'Nova poruka',
   snippet: item.sender_name, unread: true, createdAt: item.created_at })),
 ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3) :
  conversations.slice(0, 3).map(item => ({ id: item.id, title: item.job_name, detail: item.sender_name,
   snippet: item.body, unread: item.unread }));
 const previewError = open === '/obavestenja' ? error : messagesError;

 return <nav className="team-header-links" ref={nav} aria-label="Poruke i obaveštenja" onBlur={event => {
  if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(null);
 }}>{inboxes.map(({ to, label, action, empty, Icon }) => {
  const count = counts[to];
  const expanded = open === to;
  const current = location.pathname === to || location.pathname.startsWith(`${to}/`);
  return <div key={to}>
   <button className="team-inbox-toggle" type="button" title={label} aria-label={count ? `${label} (${count} novih)` : label}
    aria-expanded={expanded} aria-controls={expanded ? panelId : undefined} aria-current={current ? 'page' : undefined}
    onClick={() => setOpen(expanded ? null : to)}>
    <Icon aria-hidden="true"/>{count > 0 && <b className="team-badge" aria-hidden="true">{count}</b>}
   </button>
   {expanded && <section className="team-inbox-panel" id={panelId} aria-labelledby={`${panelId}-title`}>
    <h2 id={`${panelId}-title`}>{label}</h2>
    {previewError && <p role="status">{previewError}</p>}
    {!previewError && !previews.length && <p>{empty}</p>}
    {previews.length > 0 && <ul>{previews.map(item => <li key={item.id} className={item.unread ? 'unread' : undefined}>
     <Link className="team-inbox-preview" to={to} onClick={() => setOpen(null)}>
      <small>{item.detail}{item.unread && ' · Novo'}</small>
      <strong>{item.title}</strong>
      {item.snippet && <span>{item.snippet}</span>}
     </Link>
    </li>)}</ul>}
    <Link className="team-inbox-open" to={to} onClick={() => setOpen(null)}>{action}<span><ArrowRight aria-hidden="true"/></span></Link>
   </section>}
  </div>;
 })}</nav>;
}
