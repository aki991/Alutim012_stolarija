import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BookOpen, Calculator, ChevronRight, Download, FileText, HardDrive, Layers, Percent, Settings as SettingsIcon, Upload, Users } from 'lucide-react';
import { useStore } from './store';
import type { Settings } from './models';
import { Field, Saved } from './components/UI';
import { ModuleHeader } from './components/ModuleHeader';
import { PricingSettings } from './components/PricingSettings';
import { TeamAccounts } from './components/TeamAccounts';
import { UserGuide } from './components/UserGuide';
const sections=[
 {id:'profili',title:'Profili i materijali',description:'ALU, PVC, boje i osnovne opcije',Icon:Layers},
 {id:'cenovnik',title:'Cenovnik',description:'Cene profila, stakla, roletni i usluga',Icon:Calculator},
 {id:'pdv',title:'PDV i obračun',description:'Stopa PDV-a i način obračuna',Icon:Percent},
 {id:'dokumenti',title:'Dokumenti',description:'Podrazumevani uslovi ponude',Icon:FileText},
 {id:'korisnici',title:'Korisnici',description:'Upravljanje nalozima zaposlenih',Icon:Users},
 {id:'podaci',title:'Podaci i rezervne kopije',description:'Majstor, čuvanje, uvoz i izvoz',Icon:HardDrive},
 {id:'uputstvo',title:'Uputstvo',description:'Vodič kroz aplikaciju i PDF za preuzimanje',Icon:BookOpen},
];
const newDefaults:NonNullable<Settings['elementDefaults']>={material:'PVC',profile:'PVC 70 mm',color:'Bela',glass:'Dvoslojno',hardware:'Standardni'};
export function SettingsPage({forcedSection}:{forcedSection?:string}){
 const {section}=useParams(),current=sections.find(s=>s.id===(forcedSection||section)),{settings,setSettings,jobs,trash,importData,saveState,teamMember,teamPricingRevision}=useStore();
 const [message,setMessage]=useState('');
 const element={...newDefaults,...settings.elementDefaults},document=settings.documentDefaults||{validity:'15 dana',delivery:'Po dogovoru, nakon tehničke provere',payment:'50% avans, ostatak po montaži'};
 const setElement=(patch:Partial<NonNullable<Settings['elementDefaults']>>)=>setSettings({elementDefaults:{...element,...patch}});
 const setDocument=(patch:Partial<NonNullable<Settings['documentDefaults']>>)=>setSettings({documentDefaults:{...document,...patch}});
 const backup=()=>{const data=new Blob([JSON.stringify({jobs,trash,settings},null,2)],{type:'application/json'}),url=URL.createObjectURL(data),a=window.document.createElement('a');a.href=url;a.download='alu-tim-rezervna-kopija.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const showPrices=settings.showPrices!==false;
 const isAdmin=teamMember?.role==='manager';
 const showPricingSettings=showPrices||Boolean(teamMember&&teamPricingRevision===null);
 if((!showPricingSettings&&(current?.id==='cenovnik'||current?.id==='pdv'))||(current?.id==='korisnici'&&!isAdmin))return <Navigate to="/podesavanja" replace/>;
 const categoryList=<nav className="settings-categories" aria-label="Celine podešavanja">{sections.filter(s=>(s.id!=='korisnici'||isAdmin)&&(showPricingSettings||!["cenovnik","pdv"].includes(s.id))).map(({id,title,description,Icon})=><Link key={id} className={current?.id===id?'selected':''} to={id==='cenovnik'?'/cenovnik':`/podesavanja/${id}`}><Icon aria-hidden="true"/><span><strong>{title}</strong><small>{description}</small></span><ChevronRight aria-hidden="true"/></Link>)}</nav>;
 return <div className={`module-page settings-page ${current?'settings-detail':''}`}><ModuleHeader title={current?.title||'Podešavanja'} subtitle={current?undefined:'Osnovna podešavanja aplikacije.'} icon={current?.Icon||SettingsIcon} back={current?'/podesavanja':undefined}/>
 <main className="module-content">{!current?<><label className="settings-price-toggle"><input type="checkbox" checked={showPrices} disabled={Boolean(teamMember&&teamPricingRevision===null)} onChange={e=>setSettings({showPrices:e.target.checked})}/><span><strong>Prikaži cene</strong><small>Isključite za merenje i dokumente bez cena.</small></span></label>{categoryList}</>:<div className="settings-detail-layout"><aside>{categoryList}</aside><section className="settings-detail-panel">{!(current.id==='uputstvo'||current.id==='korisnici'||teamMember&&(current.id==='cenovnik'||current.id==='pdv'))&&<div className="settings-save"><Saved state={saveState} shared={Boolean(teamMember)}/></div>}
  {current.id==='uputstvo'&&<UserGuide/>}
  {current.id==='profili'&&<><p className="settings-note">Podrazumevano za nove elemente. Postojeći elementi ostaju neizmenjeni.</p><div className="settings-fields"><Field label="Materijal"><select value={element.material} onChange={e=>setElement({material:e.target.value as 'PVC'|'ALU',profile:e.target.value==='PVC'?'PVC 70 mm':'ALU termo profil'})}><option>PVC</option><option>ALU</option></select></Field><Field label="Profil"><select value={element.profile} onChange={e=>setElement({profile:e.target.value})}>{(element.material==='PVC'?['PVC 70 mm','PVC 76 mm','PVC 82 mm']:['ALU termo profil','ALU hladni profil']).map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Boja"><select value={element.color} onChange={e=>setElement({color:e.target.value})}>{['Bela','Antracit','Zlatni hrast'].map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Staklo"><select value={element.glass} onChange={e=>setElement({glass:e.target.value as typeof element.glass})}>{['Dvoslojno','Troslojno','Sigurnosno'].map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Okov"><select value={element.hardware} onChange={e=>setElement({hardware:e.target.value as typeof element.hardware})}>{['Standardni','Sigurnosni'].map(s=><option key={s}>{s}</option>)}</select></Field></div></>}
  {(current.id==='cenovnik'||current.id==='pdv')&&<PricingSettings key={current.id} section={current.id}/>}
  {current.id==='korisnici'&&teamMember&&<TeamAccounts member={teamMember}/>}
  {current.id==='dokumenti'&&<><p className="settings-note">Uslovi za nove poslove. {showPrices?' Pojedinačnu ponudu možete naknadno izmeniti u pregledu cene.':''}</p><Field label="Važenje ponude"><input maxLength={200} value={document.validity} onChange={e=>setDocument({validity:e.target.value})}/></Field><Field label="Rok isporuke"><input maxLength={300} value={document.delivery} onChange={e=>setDocument({delivery:e.target.value})}/></Field><Field label="Način plaćanja"><input maxLength={200} value={document.payment} onChange={e=>setDocument({payment:e.target.value})}/></Field></>}
  {current.id==='podaci'&&(teamMember?<><p className="settings-note">Zajednički poslovi se čuvaju u bazi. Prijavljeni ste kao {teamMember.name}.</p><Link className="field-button field-button-light" to="/nalog">Otvori nalog</Link></>:<><Field label="Ime majstora"><input maxLength={100} value={settings.technician} onChange={e=>setSettings({technician:e.target.value})}/></Field><p className="settings-note">{jobs.length} poslova na ovom uređaju. Kopija sadrži sačuvane poslove i fotografije.</p><div className="backup-actions"><button className="field-button field-button-light" onClick={backup}><Download/>Izvezi rezervnu kopiju</button><label className="field-button field-button-light upload-label"><Upload/>Uvezi kopiju<input type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>8e6)throw Error('Kopija je veća od 8 MB.');const data=JSON.parse(await file.text());if(!confirm('Uvoz će zameniti sve trenutne poslove i podešavanja. Nastaviti?'))return;importData(data);setMessage('Rezervna kopija je uvezena.');}catch(error){setMessage((error as Error).message);}finally{e.target.value='';}}}/></label></div>{message&&<p className="field-message" role="status">{message}</p>}</>)}
 </section></div>}</main>
 </div>;
}
