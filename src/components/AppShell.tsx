import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Calculator, ClipboardList, FileText, House, LayoutGrid, LogIn, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Play, Settings, UserRound } from 'lucide-react';
import { isActiveJob } from '../models';
import { awaitingMeasurements, useStore } from '../store';
import { useNavigation } from '../navigation';
import { Modal } from './UI';
import { ReferenceHeader } from './ReferenceHeader';
const links=[{to:'/',label:'Početna',Icon:House},{to:'/poslovi',label:'Poslovi',Icon:BriefcaseBusiness},{to:'/katalog',label:'Katalog',Icon:LayoutGrid},{to:'/ponude',label:'Ponude',Icon:FileText},{to:'/cenovnik',label:'Cenovnik',Icon:Calculator},{to:'/podesavanja',label:'Podešavanja',Icon:Settings}];
function activeSection(path:string,to:string){return to==='/'?path==='/':to==='/poslovi'?path.startsWith('/poslovi')||path.startsWith('/posao/'):to==='/cenovnik'?path.startsWith('/cenovnik')||path==='/podesavanja/cenovnik':to==='/podesavanja'?path.startsWith('/podesavanja')&&path!=='/podesavanja/cenovnik':path.startsWith(to);}
export function AppShell({children,onNew,onSearch,onNotifications,onNavigation}:{children:ReactNode;onNew:()=>void;onSearch:()=>void;onNotifications:()=>void;onNavigation:()=>void}){
 const location=useLocation(),state=useStore(),{jobs,settings,teamMember}=state,navigation=useNavigation();
 const accountLink=teamMember?{to:'/nalog',label:'Nalog',Icon:UserRound}:{to:'/prijava',label:'Prijava zaposlenih',Icon:LogIn};
 const [width,setWidth]=useState(window.innerWidth),[more,setMore]=useState(false);
 const mainRef=useRef<HTMLDivElement>(null);
 const previousPath=useRef('');
 const visibleLinks=links.filter(link=>settings.showPrices!==false||link.to!=='/cenovnik');
 if(teamMember?.role==='manager')visibleLinks.splice(3,0,{to:'/dodeli-merenje',label:'Dodeli merenje',Icon:ClipboardList});
 const field=location.pathname.startsWith('/posao/'),home=location.pathname==='/';
 const compact=navigation.sidebar==='auto'?(width<1000||field):navigation.sidebar==='compact';
 const activeJob=jobs.find(j=>j.id===navigation.jobId&&isActiveJob(j)&&!awaitingMeasurements(state,j));
 const resume=activeJob&&navigation.workPath?.startsWith(`/posao/${activeJob.id}`)?navigation.workPath:activeJob?`/posao/${activeJob.id}`:null;
 useEffect(()=>{const resize=()=>setWidth(window.innerWidth);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 useEffect(()=>{
  const catalog=location.pathname==='/katalog'||/^\/posao\/[^/]+\/modeli$/.test(location.pathname);
  const portaCatalog=location.pathname.endsWith('/sobna-vrata');
  const scrollPage=portaCatalog?`${location.pathname}:${new URLSearchParams(location.search).get('serija')??''}`:location.pathname;
  const samePath=previousPath.current===scrollPage;
  previousPath.current=scrollPage;
  setMore(false);
  if((catalog||portaCatalog)&&samePath)return;
  window.scrollTo(0,0);mainRef.current?.scrollTo(0,0);
  if(catalog&&location.hash==='#catalog-model-browser')document.getElementById('catalog-model-browser')?.scrollIntoView();
 },[location.pathname,location.search]);
 const routeJobId=location.pathname.match(/^\/posao\/([^/]+)/)?.[1];
 const activeRouteJobId=jobs.find(j=>j.id===routeJobId&&isActiveJob(j)&&!awaitingMeasurements(state,j))?.id;
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
   <Link className={`sidebar-local team-sidebar-link ${location.pathname===accountLink.to?'active':''}`} to={accountLink.to} title={accountLink.label} aria-label={accountLink.label}><accountLink.Icon/><div><strong>{accountLink.label}</strong>{teamMember&&<span>{teamMember.name}</span>}</div></Link>
   <button className="sidebar-toggle" onClick={()=>navigation.toggleSidebar(compact)} aria-label={compact?'Proširi navigaciju':'Skupi navigaciju'} title={compact?'Proširi navigaciju':'Skupi navigaciju'}>{compact?<PanelLeftOpen/>:<PanelLeftClose/>}</button>
  </aside>
  <div className="main-shell" ref={mainRef}>
   {home&&<ReferenceHeader onSearch={onSearch} onNotifications={onNotifications} technician={teamMember?.name??settings.technician} team={Boolean(teamMember)}/>}
   {!home&&!field&&resume&&<div className="resume-strip"><Link to={resume}><Play size={18}/>Nastavi merenje <strong>{activeJob!.customer.name}</strong><ArrowRight size={18}/></Link>{resume!==`/posao/${activeJob!.id}`&&<Link to={`/posao/${activeJob!.id}`}>Pregled posla</Link>}</div>}
   <div className={`main-content ${field?'work-content':''}`}>{children}</div>
  </div>
  <nav className="mobile-bottom-nav" aria-label="Donja navigacija">
   {links.slice(0,3).map(({to,label,Icon})=><Link key={to} to={to} className={!more&&activeSection(location.pathname,to)?'active':''} aria-current={activeSection(location.pathname,to)?'page':undefined} onClick={onNavigation}><Icon aria-hidden="true"/><span>{label}</span></Link>)}
   <button className={more||['/ponude','/podesavanja','/cenovnik','/nalog','/dodeli-merenje'].some(p=>location.pathname.startsWith(p))?'active':''} aria-expanded={more} aria-label="Više" onClick={()=>{onNavigation();setMore(!more);}}><MoreHorizontal aria-hidden="true"/><span>Više</span></button>
  </nav>
  {more&&<Modal title="Više" sheet onClose={()=>setMore(false)}><nav className="more-navigation" aria-label="Dodatna navigacija"><Link to={accountLink.to} onClick={()=>setMore(false)}><accountLink.Icon/>{accountLink.label}<ArrowRight/></Link>{visibleLinks.slice(3).map(({to,label,Icon})=><Link key={to} to={to} onClick={()=>setMore(false)}><Icon/>{label}<ArrowRight/></Link>)}{resume&&<Link to={resume} onClick={()=>setMore(false)}><Play/>Nastavi merenje<ArrowRight/></Link>}<button onClick={()=>{setMore(false);onNew();}}><BriefcaseBusiness/>Novi posao<ArrowRight/></button></nav></Modal>}
 </div>;
}
