import { useState, type ComponentPropsWithoutRef } from 'react';

type NumberInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'|'value'> & {
 value: number | '';
 clearToZero?: boolean;
};

export function NumberInput({value,clearToZero=false,onChange,onBlur,...props}:NumberInputProps){
 const [cleared,setCleared]=useState(false);
 const showEmpty=cleared&&(!clearToZero||value===0);
 return <input {...props} type="number" value={showEmpty?'':value}
  onChange={event=>{
   const empty=event.currentTarget.value==='';
   setCleared(empty);
   if(!empty||clearToZero&&!event.currentTarget.validity.badInput)onChange?.(event);
  }}
  onBlur={event=>{
   if(!clearToZero)setCleared(false);
   onBlur?.(event);
  }}
 />;
}
