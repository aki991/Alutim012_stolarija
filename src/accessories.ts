import type { AccessoryKind, Position } from './models';

export const accessories=[
 {key:'mosquito',label:'Komarnik',widthLabel:'Širina komarnika (mm)',heightLabel:'Visina komarnika (mm)'},
 {key:'sill',label:'Klupica',widthLabel:'Dužina klupice (mm)',heightLabel:'Dubina klupice (mm)'},
 {key:'drip',label:'Okapnica',widthLabel:'Dužina okapnice (mm)',heightLabel:'Dubina okapnice (mm)'},
] as const;

export function hasMosquitoMotor(p:Position){
 return Boolean(p.mosquitoMotor&&(p.mosquito||p.category==='Komarnici'));
}

export function accessorySize(p:Position,kind:AccessoryKind):{width:number;height?:number}{
 const custom=p.accessoryDimensions?.[kind];
 return {width:custom?.width??(kind==='mosquito'?p.width-50:p.width),
  height:custom?.height??(kind==='mosquito'?p.height-10:undefined)};
}

export function accessoryDimensionPatch(p:Position,kind:AccessoryKind,axis:'width'|'height',value:number|undefined):Partial<Position>{
 const size={...p.accessoryDimensions?.[kind]};
 if(value===undefined)delete size[axis];else size[axis]=value;
 return {accessoryDimensions:{...p.accessoryDimensions,[kind]:size}};
}

export function resetAccessoryDimensions(p:Position,kind:AccessoryKind):Partial<Position>{
 const dimensions={...p.accessoryDimensions};delete dimensions[kind];
 return {accessoryDimensions:dimensions};
}

export function isAccessoryDimensions(value:unknown):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 return Object.entries(value).every(([kind,size])=>accessories.some(item=>item.key===kind)
  &&size&&typeof size==='object'&&!Array.isArray(size)
  &&Object.entries(size).every(([axis,number])=>(axis==='width'||axis==='height')&&typeof number==='number'&&Number.isFinite(number)&&Math.abs(number)<=1e8));
}

export function validateAccessories(p:Position):string[]{
 return accessories.filter(({key})=>p[key]).flatMap(({key,label})=>{
  const {width,height}=accessorySize(p,key);
  return !Number.isFinite(width)||width<=0||width>20000||height!==undefined&&(!Number.isFinite(height)||height<=0||height>20000)
   ?[`${label}: unesite mere od 1 do 20000 mm.`]:[];
 });
}
