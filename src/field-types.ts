import { emptyGeometry } from './custom/geometry';
import { catalog, makePosition } from './catalog';
import type { Position } from './models';
export const fieldTypes = [
 {id:'prozor',label:'Prozor',template:1},
 {id:'vrata',label:'Vrata',template:7},
 {id:'balkonska',label:'Balkonska vrata',template:5},
 {id:'klizni',label:'Klizni sistem',template:11},
 {id:'fiksni',label:'Fiksni element',template:3},
 {id:'roletna',label:'Roletna',template:13},
 {id:'komarnik',label:'Komarnik',template:14},
 {id:'ostalo',label:'Ostalo',template:16},
 {id:'nacrtaj',label:'Nacrtaj',template:3},
] as const;
export const selectableFieldTypes = fieldTypes.filter(type=>type.id!=='ostalo');

export function makeFieldPosition(type:string,template?:number):Position {
 const entry=fieldTypes.find(t=>t.id===type)||fieldTypes[0];
 const p=makePosition(catalog[template??entry.template]||catalog[1]);
 p.elementType=template===undefined?entry.id:typeOfPosition(p);
 if(template===undefined){p.name=entry.label;if(type==='balkonska')p.height=2200;
  p.segments=p.segments.map((s,i)=>({...s,opening:type==='klizni'?'Klizno':['fiksni','roletna','komarnik','ostalo'].includes(type)?'Fiksno':i===0?'Levo':'Desno'}));
 }
 if(type==='nacrtaj'){p.customGeometry=emptyGeometry();p.name='Nacrtan element';p.segments=[{width:p.width,opening:'Fiksno'}];p.installation=false;}
 return p;
}
export function typeOfPosition(p:Position):string {
 if(p.customGeometry)return 'nacrtaj';
 if(fieldTypes.some(t=>t.id===p.elementType))return p.elementType!;
 return p.category==='Roletne'?'roletna':p.category==='Komarnici'?'komarnik':p.category==='Klizni sistemi'?'klizni':p.name.toLowerCase().includes('balkonsk')?'balkonska':p.category==='Vrata'||p.category==='Ulazna vrata'?'vrata':p.category==='Usluge'||p.category==='Klupice'?'ostalo':p.name.toLowerCase().includes('fiksn')?'fiksni':'prozor';
}
