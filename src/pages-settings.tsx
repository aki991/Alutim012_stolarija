import { NumberInput } from './components/NumberInput';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Calculator, ChevronRight, Download, FileText, HardDrive, Layers, Percent, Settings as SettingsIcon, Upload } from 'lucide-react';
import { useStore } from './store';
import type { Prices, Settings } from './models';
import { defaults } from './services/calculation';
import { supplementLabels, type SupplementRate } from './services/pricing-rates';
import { shutterTypes, type ShutterRate } from './shutters';
import { Field, Saved } from './components/UI';
import { ModuleHeader } from './components/ModuleHeader';
import { PortaPriceSettings } from './components/PortaPriceSettings';
const sections=[
 {id:'profili',title:'Profili i materijali',description:'ALU, PVC, boje i osnovne opcije',Icon:Layers},
 {id:'cenovnik',title:'Cenovnik',description:'Cene profila, stakla, roletni i usluga',Icon:Calculator},
 {id:'pdv',title:'PDV i obračun',description:'Stopa PDV-a i način obračuna',Icon:Percent},
 {id:'dokumenti',title:'Dokumenti',description:'Podrazumevani uslovi ponude',Icon:FileText},
 {id:'podaci',title:'Podaci i rezervne kopije',description:'Majstor, čuvanje, uvoz i izvoz',Icon:HardDrive},
];
const priceFields=(...keys:SupplementRate[]):[keyof Prices,string,string][]=>keys.map(key=>[key,supplementLabels[key][0],key==='profileColor'?'%':`€/${supplementLabels[key][1]}`]);
const groups:{title:string;note?:string;keys:[keyof Prices,string,string][]}[]=[
 {title:'Prodajna cena',note:'Marža se dodaje na automatski obračun po komadu. Na primer, 20% na 100 € daje 120 €.',keys:[['marginPercent','Marža','%']]},
 {title:'Profili',keys:[['PVC','PVC profil','€/m²'],['ALU','ALU profil','€/m²'],...priceFields('pvc76','pvc82','aluCold','profileColor')]},
 {title:'Staklo',keys:[['Dvoslojno','Dvoslojno','€/m²'],['Troslojno','Troslojno','€/m²'],['Sigurnosno','Sigurnosno','€/m²']]},
 {title:'Ispune i posebni oblici',keys:priceFields('panel','louvres','divider','bendPVC','bendALU','shapedInfill')},
 {title:'Okovi',keys:[['hardware','Standardni okov','€/krilo'],['secureHardware','Sigurnosni okov','€/krilo'],...priceFields('tiltHardware','slideHardware','foldHardware','pivotHardware','specialHardware')]},
 {title:'Posebni sistemi i pogoni',keys:priceFields('liftSlide','tiltSlide','retractSlide','multiTrack','pocket','motor','automaticDoor','revolvingDoor','garageMechanism','certifiedDoor')},
 {title:'Dodaci',keys:[['shutter','Roletna','€/m²'],['mosquito','Komarnik','€/m²'],['sill','Klupica','€/m']]},
 {title:'Usluge',keys:[['installation','Montaža','€/m obima'],['removal','Demontaža','€/m obima'],['transport','Podrazumevani transport','€'],...priceFields('service')]},
];
const newDefaults:NonNullable<Settings['elementDefaults']>={material:'PVC',profile:'PVC 70 mm',color:'Bela',glass:'Dvoslojno',hardware:'Standardni'};
export function SettingsPage({forcedSection}:{forcedSection?:string}){
 const {section}=useParams(),current=sections.find(s=>s.id===(forcedSection||section)),{settings,setSettings,jobs,importData,saveState,teamMember}=useStore();
 const [message,setMessage]=useState('');
 const element={...newDefaults,...settings.elementDefaults},document=settings.documentDefaults||{validity:'15 dana',delivery:'Po dogovoru, nakon tehničke provere',payment:'50% avans, ostatak po montaži'};
 const setElement=(patch:Partial<NonNullable<Settings['elementDefaults']>>)=>setSettings({elementDefaults:{...element,...patch}});
 const setDocument=(patch:Partial<NonNullable<Settings['documentDefaults']>>)=>setSettings({documentDefaults:{...document,...patch}});
 const setShutterRate=(rate:ShutterRate,value:string)=>{
  const prices={...useStore.getState().settings.prices};
  if(value==='')delete prices[rate];
  else prices[rate]=Math.max(0,Math.min(100000,Number(value)));
  setSettings({prices});
 };
 const shutterRates=<section className="price-settings-group"><h2>Cene po tipu roletne</h2>
  <p className="settings-note">Za prazno polje primenjuje se osnovna cena roletne.</p>
  <div className="settings-fields">{Object.values(shutterTypes).map(({rate,label})=><Field key={rate} label={`${label} (€/m²)`}>
   <span className="price-input"><input aria-label={`${label} (€/m²)`} type="number" inputMode="decimal" min={0} max={100000} step="0.01" value={settings.prices[rate]??''} placeholder={String(settings.prices.shutter)} onChange={event=>{if(!event.target.validity.badInput)setShutterRate(rate,event.target.value);}}/><span>€/m²</span></span>
  </Field>)}</div>
 </section>;
 const backup=()=>{const data=new Blob([JSON.stringify({jobs,settings},null,2)],{type:'application/json'}),url=URL.createObjectURL(data),a=window.document.createElement('a');a.href=url;a.download='alu-tim-rezervna-kopija.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const showPrices=settings.showPrices!==false;
 if(!showPrices&&(current?.id==='cenovnik'||current?.id==='pdv'))return <Navigate to="/podesavanja" replace/>;
 const categoryList=<nav className="settings-categories" aria-label="Celine podešavanja">{sections.filter(s=>showPrices||!["cenovnik","pdv"].includes(s.id)).map(({id,title,description,Icon})=><Link key={id} className={current?.id===id?'selected':''} to={id==='cenovnik'?'/cenovnik':`/podesavanja/${id}`}><Icon aria-hidden="true"/><span><strong>{title}</strong><small>{description}</small></span><ChevronRight aria-hidden="true"/></Link>)}</nav>;
 return <div className={`module-page settings-page ${current?'settings-detail':''}`}><ModuleHeader title={current?.title||'Podešavanja'} subtitle={current?undefined:'Osnovna podešavanja aplikacije.'} icon={current?.Icon||SettingsIcon} back={current?'/podesavanja':undefined}/>
 <main className="module-content">{!current?<><label className="settings-price-toggle"><input type="checkbox" checked={showPrices} onChange={e=>setSettings({showPrices:e.target.checked})}/><span><strong>Prikaži cene</strong><small>Isključite za merenje i dokumente bez cena.</small></span></label>{categoryList}</>:<div className="settings-detail-layout"><aside>{categoryList}</aside><section className="settings-detail-panel"><div className="settings-save"><Saved state={saveState}/></div>
  {current.id==='profili'&&<><p className="settings-note">Podrazumevano za nove elemente. Postojeći elementi ostaju neizmenjeni.</p><div className="settings-fields"><Field label="Materijal"><select value={element.material} onChange={e=>setElement({material:e.target.value as 'PVC'|'ALU',profile:e.target.value==='PVC'?'PVC 70 mm':'ALU termo profil'})}><option>PVC</option><option>ALU</option></select></Field><Field label="Profil"><select value={element.profile} onChange={e=>setElement({profile:e.target.value})}>{(element.material==='PVC'?['PVC 70 mm','PVC 76 mm','PVC 82 mm']:['ALU termo profil','ALU hladni profil']).map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Boja"><select value={element.color} onChange={e=>setElement({color:e.target.value})}>{['Bela','Antracit','Zlatni hrast'].map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Staklo"><select value={element.glass} onChange={e=>setElement({glass:e.target.value as typeof element.glass})}>{['Dvoslojno','Troslojno','Sigurnosno'].map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Okov"><select value={element.hardware} onChange={e=>setElement({hardware:e.target.value as typeof element.hardware})}>{['Standardni','Sigurnosni'].map(s=><option key={s}>{s}</option>)}</select></Field></div></>}
  {current.id==='cenovnik'&&<><p className="settings-note price-demo-note">Početne stope su demonstracione. Unesite cene firme za svoje ponude.</p>{groups.map(group=><section className="price-settings-group" key={group.title}><h2>{group.title}</h2>{group.note&&<p className="settings-note">{group.note}</p>}<div className="settings-fields">{group.keys.map(([key,label,unit])=><Field key={key} label={`${label} (${unit})`}><span className="price-input"><NumberInput clearToZero aria-label={`${label} (${unit})`} inputMode="decimal" min={0} max={100000} step="0.01" value={settings.prices[key]??defaults.prices[key]??0} onChange={e=>setSettings({prices:{...settings.prices,[key]:Math.max(0,Math.min(100000,+e.target.value))}})}/><span>{unit}</span></span></Field>)}</div></section>)}{shutterRates}<PortaPriceSettings/><button className="field-button field-button-light" onClick={()=>{if(confirm('Vratiti početne demonstracione cene?'))setSettings({prices:{...defaults.prices},portaRoyalPrices:undefined});}}>Vrati početni cenovnik</button></>}
  {current.id==='pdv'&&<div className="settings-fields"><Field label="Način unosa cena"><select value={settings.vatMode} onChange={e=>setSettings({vatMode:e.target.value as Settings['vatMode']})}><option value="exclusive">Cene bez PDV-a · porez se dodaje</option><option value="inclusive">Cene sa PDV-om · porez je uključen</option><option value="none">Bez obračuna PDV-a</option></select></Field><Field label="Stopa PDV-a (%)"><NumberInput clearToZero inputMode="decimal" min={0} max={100} value={settings.vat} onChange={e=>setSettings({vat:Math.max(0,Math.min(100,+e.target.value))})}/></Field><p className="settings-note">Izabrani režim važi za sve cene, radove i ručne korekcije.</p></div>}
  {current.id==='dokumenti'&&<><p className="settings-note">Uslovi za nove poslove. {showPrices?' Pojedinačnu ponudu možete naknadno izmeniti u pregledu cene.':''}</p><Field label="Važenje ponude"><input maxLength={200} value={document.validity} onChange={e=>setDocument({validity:e.target.value})}/></Field><Field label="Rok isporuke"><input maxLength={300} value={document.delivery} onChange={e=>setDocument({delivery:e.target.value})}/></Field><Field label="Način plaćanja"><input maxLength={200} value={document.payment} onChange={e=>setDocument({payment:e.target.value})}/></Field></>}
  {current.id==='podaci'&&(teamMember?<><p className="settings-note">Zajednički poslovi se čuvaju u bazi. Prijavljeni ste kao {teamMember.name}.</p><Link className="field-button field-button-light" to="/tim">Otvori nalog i obaveštenja</Link></>:<><Field label="Ime majstora"><input maxLength={100} value={settings.technician} onChange={e=>setSettings({technician:e.target.value})}/></Field><p className="settings-note">{jobs.length} poslova na ovom uređaju. Kopija sadrži sačuvane poslove i fotografije.</p><div className="backup-actions"><button className="field-button field-button-light" onClick={backup}><Download/>Izvezi rezervnu kopiju</button><label className="field-button field-button-light upload-label"><Upload/>Uvezi kopiju<input type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>8e6)throw Error('Kopija je veća od 8 MB.');const data=JSON.parse(await file.text());if(!confirm('Uvoz će zameniti sve trenutne poslove i podešavanja. Nastaviti?'))return;importData(data);setMessage('Rezervna kopija je uvezena.');}catch(error){setMessage((error as Error).message);}finally{e.target.value='';}}}/></label></div>{message&&<p className="field-message" role="status">{message}</p>}</>)}
 </section></div>}</main>
 </div>;
}
