import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from './UI';
export function FieldHeader({title,back,children}:{title:string;back:string;children?:ReactNode}){
 return <header className="field-header"><Link to={back} className="field-back" aria-label="Nazad"><ArrowLeft aria-hidden="true"/></Link><h1>{title}</h1><div className="field-header-actions">{children}</div><Link to="/" className="field-logo" aria-label="ALU TIM 012 — Početna"><Logo/></Link></header>;
}
