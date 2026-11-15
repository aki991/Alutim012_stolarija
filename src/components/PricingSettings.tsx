import { useState } from 'react';
import type { Prices, Settings } from '../models';
import { defaults } from '../services/calculation';
import { supplementLabels, type SupplementRate } from '../services/pricing-rates';
import { type PriceSettings, TeamRequestError } from '../services/team-api';
import { shutterTypes, type ShutterRate } from '../shutters';
import { canEditPrices, localPricingForImport, refreshTeamPricing, saveWorkspacePricing, useStore } from '../store';
import { NumberInput } from './NumberInput';
import { PortaPriceSettings } from './PortaPriceSettings';
import { Field } from './UI';

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

const rate = (value:string) => Math.max(0,Math.min(100000,Number(value)));

export function PricingSettings({section}:{section:'cenovnik'|'pdv'}){
 const {settings,setSettings,teamMember,teamPricingRevision:revision,teamPricingError}=useStore();
 const editable=canEditPrices({teamMember});
 const [draft,setDraft]=useState<{values:PriceSettings;revision:number}|null>(null);
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState<{text:string;error:boolean}|null>(null);
 const values=draft?.values??settings;
 const localPrices=teamMember&&editable&&revision===0&&section==='cenovnik'?localPricingForImport():null;
 const conflicting=draft!==null&&draft.revision!==revision;

 function change(patch:Partial<PriceSettings>){
  if(!editable||busy)return;
  setFeedback(null);
  if(!teamMember){setSettings(patch);return;}
  if(revision===null)return;
  setDraft(previous=>({
   revision:previous?.revision??revision,
   values:{prices:values.prices,portaRoyalPrices:values.portaRoyalPrices,vat:values.vat,vatMode:values.vatMode,...previous?.values,...patch},
  }));
 }

 async function save(){
  if(!draft||conflicting||busy)return;
  setBusy(true);
  setFeedback(null);
  try{
   await saveWorkspacePricing(draft.values,draft.revision);
   setDraft(null);
   setFeedback({text:'Cene su sačuvane za ceo tim.',error:false});
  }catch(error){
   if(error instanceof TeamRequestError&&error.code==='40001')void refreshTeamPricing();
   setFeedback({text:error instanceof Error?error.message:'Čuvanje cena nije uspelo.',error:true});
  }finally{setBusy(false);}
 }

 function setShutterRate(key:ShutterRate,value:string){
  const prices={...values.prices};
  if(value==='')delete prices[key];
  else prices[key]=rate(value);
  change({prices});
 }

 if(teamMember&&revision===null)return <p role="status">{teamPricingError||'Učitavanje zajedničkog cenovnika…'}</p>;
 return <>
  {!editable&&<p className="settings-note">Cene i PDV može da menja administrator.</p>}
  {teamMember&&editable&&<div className="pricing-save-bar">
   <button type="button" className="field-button field-button-yellow" disabled={!draft||busy||conflicting} onClick={()=>void save()}>
    {busy?'Čuvam…':section==='pdv'?'Sačuvaj PDV':'Sačuvaj cenovnik'}
   </button>
   {draft&&<button type="button" className="field-button field-button-light" disabled={busy} onClick={()=>{setDraft(null);setFeedback(null);}}>
    {conflicting?'Učitaj poslednje cene':'Odbaci izmene'}
   </button>}
   {conflicting?<p role="alert">Cenovnik je u međuvremenu izmenjen. Učitajte poslednje cene pre ponovnog unosa.</p>:
    feedback&&<p role={feedback.error?'alert':'status'}>{feedback.text}</p>}
  </div>}
  {section==='cenovnik'?<>
   {(!teamMember||revision===0)&&<p className="settings-note price-demo-note">Početne stope su demonstracione.</p>}
   {localPrices&&<button type="button" className="field-button field-button-light pricing-import" disabled={busy} onClick={()=>change(localPrices)}>Učitaj ranije cene sa ovog uređaja</button>}
   {groups.map(group=><section className="price-settings-group" key={group.title}>
    <h2>{group.title}</h2>{group.note&&<p className="settings-note">{group.note}</p>}
    <div className="settings-fields">{group.keys.map(([key,label,unit])=><Field key={key} label={`${label} (${unit})`}>
     <span className="price-input"><NumberInput clearToZero aria-label={`${label} (${unit})`} inputMode="decimal" min={0} max={100000} step="0.01"
      readOnly={!editable||busy} value={values.prices[key]??defaults.prices[key]??0} onChange={event=>change({prices:{...values.prices,[key]:rate(event.target.value)}})}/><span>{unit}</span></span>
    </Field>)}</div>
   </section>)}
   <section className="price-settings-group"><h2>Cene po tipu roletne</h2>
    <p className="settings-note">Za prazno polje primenjuje se osnovna cena roletne.</p>
    <div className="settings-fields">{Object.values(shutterTypes).map(({rate:key,label})=><Field key={key} label={`${label} (€/m²)`}>
     <span className="price-input"><input aria-label={`${label} (€/m²)`} type="number" inputMode="decimal" min={0} max={100000} step="0.01" readOnly={!editable||busy}
      value={values.prices[key]??''} placeholder={String(values.prices.shutter)} onChange={event=>{if(!event.target.validity.badInput)setShutterRate(key,event.target.value);}}/><span>€/m²</span></span>
    </Field>)}</div>
   </section>
   <PortaPriceSettings rates={values.portaRoyalPrices} editable={editable&&!busy} onChange={portaRoyalPrices=>change({portaRoyalPrices})}/>
   {editable&&<button type="button" className="field-button field-button-light" disabled={busy} onClick={()=>{
    if(confirm('Vratiti početne demonstracione cene?'))change({prices:{...defaults.prices},portaRoyalPrices:undefined});
   }}>Vrati početni cenovnik</button>}
  </>:<div className="settings-fields">
   <Field label="Način unosa cena"><select value={values.vatMode} disabled={!editable||busy} onChange={event=>change({vatMode:event.target.value as Settings['vatMode']})}>
    <option value="exclusive">Cene bez PDV-a · porez se dodaje</option><option value="inclusive">Cene sa PDV-om · porez je uključen</option><option value="none">Bez obračuna PDV-a</option>
   </select></Field>
   <Field label="Stopa PDV-a (%)"><NumberInput clearToZero inputMode="decimal" min={0} max={100} readOnly={!editable||busy} value={values.vat}
    onChange={event=>change({vat:Math.max(0,Math.min(100,Number(event.target.value)))})}/></Field>
   <p className="settings-note">Izabrani režim važi za sve cene, radove i ručne korekcije.</p>
  </div>}
 </>;
}
