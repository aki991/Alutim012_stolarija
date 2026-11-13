import { portaRoyalSeries } from '../porta-royal';
import { useStore } from '../store';
import { Field } from './UI';

export function PortaPriceSettings(){
 const rates=useStore(state=>state.settings.portaRoyalPrices);
 return <details className="price-settings-group porta-equipment">
  <summary>Sobna vrata Porta Royal</summary>
  <p className="settings-note">Unesite osnovnu cenu po komadu za seriju. Za prazno polje prikazuje se „Cena po upitu“.</p>
  <div className="settings-fields">{portaRoyalSeries.map(series=><Field key={series.id} label={`${series.name} (€/kom.)`}>
   <span className="price-input"><input aria-label={`${series.name} (€/kom.)`} type="number" min={0} max={100000} step="0.01" inputMode="decimal" value={rates?.[series.id]??''} onChange={event=>{
    const {value,validity}=event.currentTarget;
    if(validity.badInput)return;
    const store=useStore.getState(),next={...store.settings.portaRoyalPrices};
    if(value==='')delete next[series.id];else next[series.id]=Math.max(0,Math.min(100000,Number(value)));
    store.setSettings({portaRoyalPrices:next});
   }}/><span>€/kom.</span></span>
  </Field>)}</div>
 </details>;
}
