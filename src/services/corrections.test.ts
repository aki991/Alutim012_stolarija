import { describe, it, expect } from 'vitest';
import { calculate, defaults } from './calculation';
import { parseBackup } from './storage';
import { makePosition } from '../catalog';
import type { Job } from '../models';
const job=():Job=>({id:'TEST',customer:{name:'Kupac',phone:'',email:'',address:'',building:''},date:'',technician:'',notes:'',status:'U izradi',positions:[{...makePosition(),manualPrice:100,quantity:2}],package:'Standard',discount:0,transport:20,extraWork:'',extraCost:0,validity:'',delivery:'',payment:'',updated:''});
describe('Korekcije i kompatibilnost poslova',()=>{
 it('popust pa uvećanje, zatim jedan PDV',()=>{const c=calculate({...job(),discount:10,surcharge:20},defaults);expect(c.discount).toBe(22);expect(c.surcharge).toBeCloseTo(39.6);expect(c.net).toBeCloseTo(237.6);expect(c.total).toBeCloseTo(285.12);});
 it('podržava fiksni iznos popusta i uvećanja',()=>{const c=calculate({...job(),discount:30,discountMode:'amount',surcharge:10,surchargeMode:'amount'},defaults);expect(c.total).toBe(240);});
 it('ograničava popust na postojeći zbir',()=>expect(calculate({...job(),discount:999,discountMode:'amount'},defaults).total).toBe(0));
 for(const vatMode of ['exclusive','inclusive','none'] as const)it(`ručni konačan iznos bez duplog obračuna: ${vatMode}`,()=>{const c=calculate({...job(),manualTotal:120,discount:20,surcharge:50,vatMode},defaults);expect(c.discount).toBe(0);expect(c.surcharge).toBe(0);expect(c.total).toBe(120);expect(c.net).toBeCloseTo(vatMode==='none'?120:100);expect(c.tax).toBeCloseTo(vatMode==='none'?0:20);});
 it('nulta ručna cena je dozvoljena, isključivanje vraća korekcije',()=>{expect(calculate({...job(),manualTotal:0,discount:10},defaults).total).toBe(0);expect(calculate({...job(),manualTotal:null,discount:10},defaults).total).toBeCloseTo(237.6);});
 it('poreski režim po poslu ne menja globalni cenovnik',()=>{const c=calculate({...job(),vat:10,vatMode:'inclusive'},defaults);expect(c.net).toBeCloseTo(200);expect(c.tax).toBeCloseTo(20);expect(defaults.vat).toBe(20);});
 it('promena statusa ne menja obračun',()=>expect(calculate({...job(),status:'Prihvaćeno'},defaults)).toEqual(calculate(job(),defaults)));
 it('stari i novi statusi, prazni opcioni podaci i korekcije prolaze kopiju',()=>{for(const status of ['U izradi','Ponuda','Čeka proveru','Prihvaćeno','Odbijeno','Završeno'] as const){const j={...job(),status,discount:150,discountMode:'amount' as const,surcharge:5,manualTotal:123,vatMode:'none' as const};expect(parseBackup({jobs:[j],settings:defaults}).jobs[0]).toMatchObject({...j,status:status==='Čeka proveru'?'Ponuda':status});}});
 it('ne prihvata nevalidne nove korekcije',()=>{for(const patch of [{manualTotal:-1},{surcharge:NaN},{vat:101},{vatMode:'bad'},{discountMode:'bad'},{surchargeMode:'bad'}])expect(()=>parseBackup({jobs:[{...job(),...patch}],settings:defaults})).toThrow();});
});
