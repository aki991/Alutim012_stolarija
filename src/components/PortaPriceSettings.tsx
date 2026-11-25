import { matchesTextSearch } from '../services/text-search';
import { portaRoyalSeries } from '../porta-royal';
import { PriceDisplay } from './PriceDisplay';
import { Field } from './UI';

export function PortaPriceSettings({rates,onChange,editable,busy,query=''}:{query?:string;rates?:Record<string,number>;onChange:(rates:Record<string,number>)=>void;editable:boolean;busy:boolean}){
 const visible=portaRoyalSeries.filter(series=>matchesTextSearch(query,'Sobna vrata Porta Royal',series.name));
 if(!visible.length)return null;
 return <details className="price-settings-group porta-equipment" open={query.trim()?true:undefined}>
  <summary>Sobna vrata Porta Royal</summary>
  <p className="settings-note">Osnovna cena po komadu za seriju.{editable?' Za prazno polje prikazuje se „Cena po upitu“.':''}</p>
  <div className="settings-fields">{visible.map(series=>editable?<Field key={series.id} label={`${series.name} (€/kom.)`}>
   <span className="price-input"><input aria-label={`${series.name} (€/kom.)`} type="number" min={0} max={100000} step="0.01" inputMode="decimal" disabled={busy} value={rates?.[series.id]??''} onChange={event=>{
    const {value,validity}=event.currentTarget;
    if(validity.badInput)return;
    const next={...rates};
    if(value==='')delete next[series.id];else next[series.id]=Math.max(0,Math.min(100000,Number(value)));
    onChange(next);
   }}/><span>€/kom.</span></span>
  </Field>:<PriceDisplay key={series.id} label={`${series.name} (€/kom.)`} value={rates?.[series.id]??'Cena po upitu'}/>)}</div>
 </details>;
}
