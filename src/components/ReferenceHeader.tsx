import { Link } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { Logo } from './UI';

export function ReferenceHeader({ onNotifications, onSearch, technician, team, unread }: {
  onNotifications: () => void;
  onSearch: () => void;
  technician: string;
  team: boolean;
  unread: number;
}) {
  const initials = technician.split(' ').map(name => name[0]).slice(0, 2).join('');
  return <header className="reference-header">
    <Link className="reference-emblem" to="/" aria-label="ALU TIM 012 — Početna"><img src="/assets/logo.png" alt="ALU TIM 012 — ALU i PVC profili"/></Link>
    <Link className="reference-header-logo" to="/" aria-label="ALU TIM 012 — Početna">
      <Logo />
      <svg className="reference-logo-phone" viewBox="86 57 124 42" role="img" aria-label="ALU TIM 012"><image href="/assets/reference-phone.png" width="338" height="735" /></svg>
    </Link>
    <span className="reference-header-tagline">ALU &amp; PVC PROFILI</span>
    <div className="reference-header-stripes" aria-hidden="true"><i /><i /><i /></div>
    <div className="reference-header-controls">
      <button className="reference-search" onClick={onSearch} aria-label="Pretraži poslove"><Search aria-hidden="true" /></button>
      <button className="reference-bell team-bell" onClick={onNotifications} aria-label={unread?`Obaveštenja (${unread} novih)`:'Obaveštenja'}><Bell aria-hidden="true" />{unread>0&&<b className="team-badge">{unread}</b>}</button>
      <Link className="reference-profile" to={team?'/tim':'/prijava'} aria-label={team?'Nalog zaposlenog':'Prijava zaposlenih'}>{initials}</Link>
    </div>
  </header>;
}
