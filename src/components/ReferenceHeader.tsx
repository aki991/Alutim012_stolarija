import { Link } from 'react-router-dom';
import { Bell, CloudDownload, Search } from 'lucide-react';
import { Logo } from './UI';

export function ReferenceHeader({ onNotifications, onSearch, technician, hasNotifications }: {
  onNotifications: () => void;
  onSearch: () => void;
  technician: string;
  hasNotifications: boolean;
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
      <Link className="reference-backup" to="/podesavanja" aria-label="Lokalne rezervne kopije"><CloudDownload aria-hidden="true" /></Link>
      <button className="reference-bell" onClick={onNotifications} aria-label="Obaveštenja"><Bell aria-hidden="true" />{hasNotifications && <i />}</button>
      <Link className="reference-profile" to="/podesavanja" aria-label="Podešavanja profila">{initials}</Link>
    </div>
  </header>;
}
