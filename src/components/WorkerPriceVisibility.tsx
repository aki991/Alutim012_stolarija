import { useState } from 'react';
import { refreshTeamPricing, saveWorkerPriceVisibility, useStore } from '../store';
import { TeamRequestError } from '../services/team-api';

export function WorkerPriceVisibility(){
 const {teamMember,teamWorkerPricesVisible:visible,teamPricingRevision:revision}=useStore();
 const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState<{text:string;error:boolean}|null>(null);
 const [selection,setSelection]=useState<boolean|null>(null);
 if(teamMember?.role!=='manager')return null;
 async function change(next:boolean){
  if(busy||revision===null||visible===null)return;
  setBusy(true);setSelection(next);setFeedback(null);
  try{
   await saveWorkerPriceVisibility(next,revision);
   setFeedback({text:next?'Prikaz cena je uključen za majstore.':'Prikaz cena je isključen za majstore.',error:false});
  }catch(error){
   if(error instanceof TeamRequestError&&error.code==='40001')void refreshTeamPricing();
   setFeedback({text:error instanceof Error?error.message:'Podešavanje nije sačuvano. Pokušajte ponovo.',error:true});
  }finally{setBusy(false);setSelection(null);}
 }
 return <div>
  <label className="settings-price-toggle"><input type="checkbox" checked={selection??(visible===true)} disabled={busy||revision===null||visible===null} onChange={e=>void change(e.target.checked)}/><span><strong>Prikaži cene majstorima</strong><small>{busy?'Čuvanje podešavanja…':revision!==null&&visible===null?'Za podešavanje prikaza cena majstorima potrebno je ažuriranje baze.':'Važi za majstore u timu. Cene i dalje menja samo šef.'}</small></span></label>
  {feedback&&<p className="settings-note" role={feedback.error?'alert':'status'}>{feedback.text}</p>}
 </div>;
}
