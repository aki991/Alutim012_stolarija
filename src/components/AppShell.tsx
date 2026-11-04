import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Calculator, ChevronLeft, FileText, HardHat, House, LayoutGrid, Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Play, Settings } from 'lucide-react';
import { isActiveJob } from '../models';
import { useStore } from '../store';
import { useNavigation } from '../navigation';
import { Logo, Modal, Saved } from './UI';
import { ReferenceHeader } from './ReferenceHeader';
const links=[{to:'/',label:'Početna',Icon:House},{to:'/poslovi',label:'Poslovi',Icon:BriefcaseBusiness},{to:'/katalog',label:'Katalog',Icon:LayoutGrid},{to:'/ponude',label:'Ponude',Icon:FileText},{to:'/cenovnik',label:'Cenovnik',Icon:Calculator},{to:'/podesavanja',label:'Podešavanja',Icon:Settings}];
function activeSection(path:string,to:string){return to==='/'?path==='/':to==='/poslovi'?path.startsWith('/poslovi')||path.startsWith('/posao/'):to==='/cenovnik'?path.startsWith('/cenovnik')||path==='/podesavanja/cenovnik':to==='/podesavanja'?path.startsWith('/podesavanja')&&path!=='/podesavanja/cenovnik':path.startsWith(to);}
export function AppShell({children,onNew,onSearch,onNotifications,onNavigation}:{children:ReactNode;onNew:()=>void;onSearch:()=>void;onNotifications:()=>void;onNavigation:()=>void}){
 const location=useLocation(),{jobs,settings,saveState}=useStore(),navigation=useNavigation();
 const [width,setWidth]=useState(window.innerWidth),[more,setMore]=useState(false);
 const mainRef=useRef<HTMLDivElement>(null);
 const visibleLinks=links.filter(link=>settings.showPrices!==false||link.to!=='/cenovnik');
 const field=location.pathname.startsWith('/posao/'),home=location.pathname==='/';
 const compact=navigation.sidebar==='auto'?(width<1000||field):navigation.sidebar==='compact';
 const activeJob=jobs.find(j=>j.id===navigation.jobId&&isActiveJob(j));
 const resume=activeJob&&navigation.workPath?.startsWith(`/posao/${activeJob.id}`)?navigation.workPath:activeJob?`/posao/${activeJob.id}`:null;
 useEffect(()=>{const resize=()=>setWidth(window.innerWidth);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 useEffect(()=>{
  setMore(false);window.scrollTo(0,0);mainRef.current?.scrollTo(0,0);
 },[location.pathname,location.search]);
 const routeJobId=location.pathname.match(/^\/posao\/([^/]+)/)?.[1];
 const activeRouteJobId=jobs.find(j=>j.id===routeJobId&&isActiveJob(j))?.id;
 const {jobId,clearJob,remember}=navigation;
 useEffect(()=>{if(jobId&&!activeJob)clearJob();},[activeJob,jobId,clearJob]);
 useEffect(()=>{
  if(activeRouteJobId)remember(activeRouteJobId,location.pathname+location.search);
 },[activeRouteJobId,location.pathname,location.search,remember]);
 return <div className={`app-shell reference-app unified-shell ${compact?'sidebar-compact':''} ${field?'field-flow':''} ${home?'reference-home-page':'work-modules'} ${navigation.fullscreen?'is-fullscreen':''}`}>
  <aside className="app-sidebar" aria-label="Glavna bočna navigacija">
   <Link to="/" className="app-brand" aria-label="ALU TIM 012 — Početna"><img className="brand-emblem" src="/assets/logo.png" alt="ALU TIM 012 — ALU i PVC profili"/></Link>
   <nav className="app-primary-nav" aria-label="Glavna navigacija">{visibleLinks.map(({to,label,Icon})=><Link key={to} to={to} className={activeSection(location.pathname,to)?'active':''} aria-current={activeSection(location.pathname,to)?'page':undefined} title={label} onClick={onNavigation}><Icon aria-hidden="true"/><span>{label}</span></Link>)}</nav>
   {resume&&<Link className="sidebar-resume" to={resume} title={`Nastavi merenje: ${activeJob!.customer.name}`}><Play/><span>Nastavi merenje<small>{activeJob!.customer.name}</small></span></Link>}
   <div className="sidebar-local"><HardHat/><div><strong>Terenski rad</strong><span><i/>Lokalno</span></div></div>
   <button className="sidebar-toggle" onClick={()=>navigation.toggleSidebar(compact)} aria-label={compact?'Proširi navigaciju':'Skupi navigaciju'} title={compact?'Proširi navigaciju':'Skupi navigaciju'}>{compact?<PanelLeftOpen/>:<PanelLeftClose/>}</button>
  </aside>
  <div className="main-shell" ref={mainRef}>
   {home&&<ReferenceHeader onSearch={onSearch} onNotifications={onNotifications} technician={settings.technician}/>}
   {!home&&!field&&resume&&<div className="resume-strip"><Link to={resume}><Play size={18}/>Nastavi merenje <strong>{activeJob!.customer.name}</strong><ArrowRight size={18}/></Link>{resume!==`/posao/${activeJob!.id}`&&<Link to={`/posao/${activeJob!.id}`}>Pregled posla</Link>}</div>}
   <div className={`main-content ${field?'work-content':''}`}>{children}</div>
  </div>
  <nav className="mobile-bottom-nav" aria-label="Donja navigacija">
   {links.slice(0,3).map(({to,label,Icon})=><Link key={to} to={to} className={!more&&activeSection(location.pathname,to)?'active':''} aria-current={activeSection(location.pathname,to)?'page':undefined} onClick={onNavigation}><Icon aria-hidden="true"/><span>{label}</span></Link>)}
   <button className={more||['/ponude','/podesavanja','/cenovnik'].some(p=>location.pathname.startsWith(p))?'active':''} aria-expanded={more} aria-label="Više" onClick={()=>{onNavigation();setMore(!more);}}><MoreHorizontal aria-hidden="true"/><span>Više</span></button>
  </nav>
  {more&&<Modal title="Više" sheet onClose={()=>setMore(false)}><nav className="more-navigation" aria-label="Dodatna navigacija">{visibleLinks.slice(3).map(({to,label,Icon})=><Link key={to} to={to} onClick={()=>setMore(false)}><Icon/>{label}<ArrowRight/></Link>)}{resume&&<Link to={resume} onClick={()=>setMore(false)}><Play/>Nastavi merenje<ArrowRight/></Link>}<button onClick={()=>{setMore(false);onNew();}}><BriefcaseBusiness/>Novi posao<ArrowRight/></button></nav></Modal>}
 </div>;
}
