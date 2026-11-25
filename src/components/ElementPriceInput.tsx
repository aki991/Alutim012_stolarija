import { useState, type ComponentPropsWithoutRef } from 'react';

type Props=Omit<ComponentPropsWithoutRef<'input'>,'value'|'onChange'|'type'>&{
 manualPrice:number|null;allocationUnit?:number;automaticUnit?:number;onChange:(base:number|null)=>void;
};
/** Edit the displayed price, retaining the base price for future cost changes. */
export function ElementPriceInput({manualPrice,allocationUnit=0,automaticUnit,onChange,...props}:Props){
 const [draft,setDraft]=useState<string|null>(null);
 return <input {...props} type="number" inputMode="decimal" min={allocationUnit} max={1e8} step="any"
  value={draft??(manualPrice===null?'':Number((manualPrice+allocationUnit).toFixed(6)))} placeholder={automaticUnit===undefined?undefined:String(Number(automaticUnit.toFixed(6)))}
  onFocus={e=>e.currentTarget.select()} onBlur={()=>setDraft(null)}
  onChange={e=>{const value=e.target.value;setDraft(value);if(value===''){onChange(null);return;}const amount=Number(value);if(Number.isFinite(amount)&&amount>=allocationUnit&&amount<=1e8)onChange(amount-allocationUnit);}}/>;
}
