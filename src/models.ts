import type { Geometry } from './custom/geometry';
export type Opening = 'Fiksno' | 'Levo' | 'Desno' | 'Kip' | 'Levo + kip' | 'Desno + kip' | 'Klizno';
export type Category = 'Prozori' | 'Vrata' | 'Klizni sistemi' | 'Ulazna vrata' | 'Roletne' | 'Komarnici' | 'Klupice' | 'Usluge';
export type Status = 'U izradi' | 'Ponuda' | 'Čeka proveru' | 'Završeno';
export type Package = 'Standard' | 'Optimal' | 'Premium';
export interface Segment { width: number; opening: Opening }
export type CustomKind = 'window' | 'door' | 'other';
export const customKindLabel = (kind?:CustomKind) => kind==='door'?'Vrata sa ramom':kind==='other'?'Element sa ramom':'Prozor sa ramom';
export interface Position { customInfill?: 'glass'|'panel'; customKind?: CustomKind; customFrameMm?: number; customGeometry?: Geometry; id: string; name: string; category: Category; elementType?: string; width: number; height: number; quantity: number; material: 'PVC' | 'ALU'; profile?: string; color: string; glass: 'Dvoslojno' | 'Troslojno' | 'Sigurnosno'; hardware: 'Standardni' | 'Sigurnosni'; segments: Segment[]; shutter: boolean; mosquito: boolean; sill: boolean; installation: boolean; removal: boolean; notes: string; access: string; extraWork: string; extraCost: number; photos: string[]; manualPrice: number | null }
export interface Customer { name: string; phone: string; email: string; address: string; building: string }
export interface Job { id: string; customer: Customer; date: string; createdAt?: string; technician: string; notes: string; status: Status; positions: Position[]; package: Package; discount: number; transport: number; extraWork: string; extraCost: number; validity: string; delivery: string; payment: string; updated: string }
export interface Prices { PVC: number; ALU: number; Dvoslojno: number; Troslojno: number; Sigurnosno: number; hardware: number; secureHardware: number; shutter: number; mosquito: number; sill: number; installation: number; removal: number; transport: number }
export interface Settings { technician: string; vat: number; vatMode: 'exclusive' | 'inclusive' | 'none'; prices: Prices; elementDefaults?: Pick<Position,'material'|'profile'|'color'|'glass'|'hardware'>; documentDefaults?: Pick<Job,'validity'|'delivery'|'payment'> }
export interface CatalogEntry { name: string; category: Category; wings: number; width: number; height: number; fixed?: boolean }

export const customInfillOf=(p:Pick<Position,'customKind'|'customInfill'>):'glass'|'panel'=>p.customInfill??(p.customKind==='door'?'panel':'glass');
