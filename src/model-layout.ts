export const movements = {
 fixed: 'Fiksno',
 left: 'Šarke levo, ručka desno',
 right: 'Šarke desno, ručka levo',
 tilt: 'Kip, šarke dole',
 tiltLeft: 'Šarke levo + kip',
 tiltRight: 'Šarke desno + kip',
 outLeft: 'Ka spolja, šarke levo',
 outRight: 'Ka spolja, šarke desno',
 awning: 'Ka spolja, šarke gore',
 outBottom: 'Ka spolja, šarke dole',
 projected: 'Izbačajno, gornji ovjes',
 parallel: 'Paralelno izbačajno',
 pivotH: 'Pivot, vodoravna osa',
 pivotV: 'Pivot, uspravna osa',
 pivotVLeft: 'Pivot, uspravna osa pomerena ulevo',
 pivotVRight: 'Pivot, uspravna osa pomerena udesno',
 doubleLeft: 'Klatno, osa levo',
 doubleRight: 'Klatno, osa desno',
 slideLeft: 'Klizi ulevo',
 slideRight: 'Klizi udesno',
 slideUp: 'Klizi nagore',
 slideDown: 'Klizi nadole',
 foldLeft: 'Sklapa se ulevo',
 foldRight: 'Sklapa se udesno',
 louvre: 'Pokretne lamele',
 revolve: 'Rotirajuća vrata',
 roll: 'Namotava se nagore',
 sectional: 'Segmenti klize pod plafon',
 sectionalLeft: 'Segmenti klize bočno ulevo',
 sectionalRight: 'Segmenti klize bočno udesno',
 canopy: 'Jednodelno krilo se podiže',
} as const;

export const infills = {glass:'Staklo', panel:'Puni panel', glassPanel:'Staklo gore, panel dole', slats:'Lamele', space:'Prazno polje'} as const;
export type Movement = keyof typeof movements;
export type Infill = keyof typeof infills;
export const glassPanelFraction=.62;
export const hasGlass=(infill:Infill)=>infill==='glass'||infill==='glassPanel';
export interface ModelCell { movement: Movement; infill: Infill; weight: number }
export interface ModelRow { weight: number; cells: ModelCell[] }
export interface ModelLayout { system: string; rows: ModelRow[]; cornerAfter?: number }

export const maxModelRows = 8;
export const maxModelCells = 24;
export const maxModelDimension = 20000;
export const weightTotal = (items: {weight:number}[]) => items.reduce((total,item)=>total+item.weight,0);

export function resizeBand<T extends {weight:number}>(items:T[], index:number, size:number, total:number):T[] {
 if(items.length<2 || !Number.isFinite(size) || size<=0 || size>=total) return items;
 const rest=weightTotal(items)-items[index].weight;
 return items.map((item,i)=>({...item,weight:i===index?size:((total-size)*item.weight)/rest}));
}

export function isModelLayout(value:unknown):value is ModelLayout {
 const layout=value as ModelLayout | undefined;
 const validWeight=(weight:number)=>Number.isFinite(weight)&&weight>0&&weight<=1e8;
 if(!layout||typeof layout.system!=='string'||!layout.system.trim()||layout.system.length>150||!Array.isArray(layout.rows)||layout.rows.length<1||layout.rows.length>maxModelRows)return false;
 if(!layout.rows.every(row=>row&&validWeight(row.weight)&&Array.isArray(row.cells)&&row.cells.length>=1&&row.cells.length<=maxModelCells&&row.cells.every(cell=>cell&&validWeight(cell.weight)&&typeof cell.movement==='string'&&Object.hasOwn(movements,cell.movement)&&typeof cell.infill==='string'&&Object.hasOwn(infills,cell.infill)&&(cell.infill!=='space'||cell.movement==='fixed'))))return false;
 const corner=layout.cornerAfter;
 return corner===undefined||(Number.isInteger(corner)&&corner>=1&&layout.rows.length===1&&corner<layout.rows[0].cells.length);
}
