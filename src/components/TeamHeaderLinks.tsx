import { NavLink } from 'react-router-dom';
import { Bell, MessageSquare } from 'lucide-react';
import { useStore } from '../store';
import { useTeamInbox } from '../team-session';

export function TeamHeaderLinks() {
 const member = useStore(state => state.teamMember);
 const { items, conversations } = useTeamInbox();
 if (!member) return null;
 const links = [
  { to: '/obavestenja', label: 'Obaveštenja', Icon: Bell, count: items.filter(item => !item.read_at).length },
  { to: '/poruke', label: 'Poruke', Icon: MessageSquare, count: conversations.filter(item => item.unread).length },
 ];
 return <nav className="team-header-links" aria-label="Poruke i obaveštenja">{links.map(({ to, label, Icon, count }) => (
  <NavLink to={to} key={to} title={label} aria-label={count ? `${label} (${count} novih)` : label}>
   <Icon size={23} aria-hidden="true"/>{count > 0 && <b className="team-badge" aria-hidden="true">{count}</b>}
  </NavLink>
 ))}</nav>;
}
