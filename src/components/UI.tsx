import { X, Check, ArrowRight, Grid2X2, DoorOpen, PanelsTopLeft, PanelTop, Blinds, Grid3X3, Ruler } from 'lucide-react';
import { useEffect, useRef, useId, cloneElement, isValidElement, type ReactElement, type ReactNode, type ButtonHTMLAttributes } from 'react';
import type { Category, Status } from '../models';
export function Logo(){return <svg viewBox="1387 329 254 81" aria-label="ALU TIM 012" role="img"><image href="/assets/reference.png" width="1672" height="941"/></svg>;}
export function CategoryIcon({category,size=24}:{category:Category;size?:number}){
 const paths=category==='Prozori'?<><path d="M5 4h30v32H5zM20 4v32M5 20h30"/></>:
 category==='Vrata'?<><path d="M9 3h23v34H9zM28 3v34"/><circle cx="25" cy="21" r=".6" fill="currentColor"/></>:
 category==='Klizni sistemi'?<><path d="M1 5h38v30H1zM5 8h30v24H5zM20 8v24M15 17l-4 3 4 3M11 20h6M25 17l4 3-4 3M23 20h6"/></>:
 category==='Ulazna vrata'?<><path d="M6 3h28v34H6zM10 3v34M30 3v34"/><circle cx="17" cy="22" r=".7" fill="currentColor"/><circle cx="27" cy="22" r=".7" fill="currentColor"/></>:
 category==='Roletne'?<><path d="M1 3h38v5H1zM5 8v29M35 8v29M5 12h30M5 16h30M5 20h30M5 24h30M5 28h30M5 32h30"/></>:
 category==='Komarnici'?<><path d="M6 3h28v34H6zM10 3v34M14 3v34M18 3v34M22 3v34M26 3v34M30 3v34M6 7h28M6 11h28M6 15h28M6 19h28M6 23h28M6 27h28M6 31h28"/></>:
 <path d="M4 12h32v16H4zM10 12v7M16 12v4M22 12v7M28 12v4"/>;
 return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">{paths}</svg>;
}
export function Button({children,variant='primary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger'}){return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>;}
export function Badge({status}:{status:Status}){return <span className={`badge badge-${status==='U izradi'?'progress':status==='Ponuda'?'offer':status==='Čeka proveru'?'review':status==='Odbijeno'?'rejected':'done'}`}><i/>{status}</span>;}
export function Modal({title,children,onClose,wide=false,sheet=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean;sheet?:boolean}){
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';if(!ref.current?.contains(document.activeElement))ref.current?.querySelector<HTMLElement>('button,input,select,textarea')?.focus();return()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
 return <div className={`modal-backdrop ${sheet?'sheet-backdrop':''}`} onClick={onClose}><section ref={ref} className={`modal ${wide?'modal-wide':''} ${sheet?'modal-sheet':''}`} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const nodes=[...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea,[tabindex="0"]')].filter(n=>n.getClientRects().length>0);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><header><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Zatvori"><X/></button></header>{children}</section></div>;
}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){
 const labelId=useId();
 const control=isValidElement(children)&&typeof children.type==='string'&&['input','select','textarea'].includes(children.type)&&!(children.props as Record<string,unknown>)['aria-label']?cloneElement(children as ReactElement<{'aria-labelledby'?:string}>,{'aria-labelledby':labelId}):children;
 return <label className="field"><span id={labelId}>{label}</span>{control}{hint&&<small>{hint}</small>}</label>;
}
export function SectionTitle({title,description,action}:{title:string;description?:string;action?:ReactNode}){return <div className="section-title"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>;}
export function Empty({title,description,action}:{title:string;description?:string;action?:ReactNode}){return <div className="empty"><Ruler size={32}/><h3>{title}</h3><p>{description}</p>{action}</div>;}
export function Saved({state}:{state:string}){return <span className={`saved ${state==='error'?'save-error':''}`}>{state==='saved'?<Check size={14}/>:<span className="save-dot"/>}{state==='saved'?'Sačuvano lokalno':state==='dirty'?'Nesačuvane izmene…':'Čuvanje nije uspelo'}</span>;}
export const MoreArrow=()=> <ArrowRight size={16}/>;
