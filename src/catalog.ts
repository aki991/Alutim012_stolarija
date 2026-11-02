import type { CatalogEntry, Category, Position } from './models';
export const categories: Category[] = ['Prozori', 'Vrata', 'Klizni sistemi', 'Ulazna vrata', 'Roletne', 'Komarnici'];
export const catalog: CatalogEntry[] = [
  {name:'Jednokrilni prozor',category:'Prozori',wings:1,width:800,height:1200},
  {name:'Dvokrilni prozor',category:'Prozori',wings:2,width:1600,height:1400},
  {name:'Trokrilni prozor',category:'Prozori',wings:3,width:2100,height:1400},
  {name:'Fiksno zastakljenje',category:'Prozori',wings:1,width:1400,height:1400,fixed:true},
  {name:'Prozor sa fiksnim delom',category:'Prozori',wings:2,width:1800,height:1400},
  {name:'Balkonska vrata',category:'Vrata',wings:1,width:900,height:2100},
  {name:'Balkonska vrata sa prozorom',category:'Vrata',wings:2,width:1800,height:2100},
  {name:'Jednokrilna ulazna vrata',category:'Ulazna vrata',wings:1,width:1000,height:2100},
  {name:'Dvokrilna vrata',category:'Vrata',wings:2,width:1600,height:2100},
  {name:'Vrata sa bočnim delom',category:'Ulazna vrata',wings:2,width:1500,height:2100},
  {name:'Vrata sa nadsvetlom',category:'Ulazna vrata',wings:1,width:1000,height:2500},
  {name:'Klizna vrata',category:'Klizni sistemi',wings:2,width:2400,height:2200},
  {name:'Podizno-klizni sistem',category:'Klizni sistemi',wings:2,width:3000,height:2300},
  {name:'Spoljna roletna',category:'Roletne',wings:1,width:1600,height:1400},
  {name:'Rolo komarnik',category:'Komarnici',wings:1,width:800,height:1400},
  {name:'Prozorska klupica',category:'Klupice',wings:1,width:1600,height:250},
  {name:'Dodatni radovi i usluge',category:'Usluge',wings:1,width:1000,height:1000},
];
export const uid = () => crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
export function makePosition(entry = catalog[1]): Position {
 return {id:uid(),name:entry.name,category:entry.category,width:entry.width,height:entry.height,quantity:1,material:'PVC',profile:'PVC 70 mm',color:'Bela',glass:'Dvoslojno',hardware:'Standardni',segments:Array.from({length:entry.wings},(_,i)=>({width:entry.width/entry.wings,opening:entry.fixed?'Fiksno':entry.category==='Klizni sistemi'?'Klizno':i===0?'Levo + kip':'Desno'})),shutter:false,mosquito:false,sill:false,installation:true,removal:false,notes:'',access:'',extraWork:'',extraCost:0,photos:[],manualPrice:null};
}
export const advancedTypes = ['Balkonska vrata sa prozorom','Vrata sa nadsvetlom'];
