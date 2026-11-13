import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from './UI';
import { TeamHeaderLinks } from './TeamHeaderLinks';
export function ModuleHeader({title,subtitle,icon:Icon,children,back}:{title:string;subtitle?:string;icon:LucideIcon;children?:ReactNode;back?:string}){
 return <header className="module-header">{back?<Link to={back} className="module-back" aria-label="Nazad"><ArrowLeft/></Link>:<Icon className="module-title-icon" aria-hidden="true"/>}<div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div><div className="module-header-actions">{children}</div><Link to="/" className="module-brand" aria-label="ALU TIM 012 — Početna"><Logo/></Link><TeamHeaderLinks/></header>;
}
