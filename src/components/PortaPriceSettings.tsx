import { portaRoyalSeries } from '../porta-royal';
import { Field } from './UI';

export function PortaPriceSettings({rates,onChange,editable}:{rates?:Record<string,number>;onChange:(rates:Record<string,number>)=>void;editable:boolean}){
 return <details className="price-settings-group porta-equipment">
  <summary>Sobna vrata Porta Royal</summary>
  <p className="settings-note">Osnovna cena po komadu za seriju. Za prazno polje prikazuje se „Cena po upitu“.</p>
  <div className="settings-fields">{portaRoyalSeries.map(series=><Field key={series.id} label={`${series.name} (€/kom.)`}>
   <span className="price-input"><input aria-label={`${series.name} (€/kom.)`} type="number" min={0} max={100000} step="0.01" inputMode="decimal" readOnly={!editable} value={rates?.[series.id]??''} onChange={event=>{
    const {value,validity}=event.currentTarget;
    if(validity.badInput)return;
    const next={...rates};
    if(value==='')delete next[series.id];else next[series.id]=Math.max(0,Math.min(100000,Number(value)));
    onChange(next);
   }}/><span>€/kom.</span></span>
  </Field>)}</div>
 </details>;
}
