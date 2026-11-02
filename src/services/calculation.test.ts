import { describe, expect, it } from 'vitest';
import { calculate, defaults, positionCost, validatePosition } from './calculation';
import { makePosition } from '../catalog';
import type { Job } from '../models';
const job = ():Job=>({id:'TEST',customer:{name:'Petrović',phone:'',email:'',address:'Pančevo',building:'Kuća'},date:'2026-11-01',technician:'Majstor',notes:'',status:'U izradi',positions:[{...makePosition(),manualPrice:100}],package:'Standard',discount:0,transport:20,extraWork:'',extraCost:0,validity:'15 dana',delivery:'Dogovor',payment:'Avans',updated:''});
describe('Demonstraciona kalkulacija',()=>{
 it('kombinuje površinu, broj krila, obim i količinu',()=>{const p=makePosition();expect(positionCost(p,defaults).unit).toBeCloseTo(420.08);p.quantity=2;p.shutter=true;p.mosquito=true;p.removal=true;expect(positionCost(p,defaults).total).toBeCloseTo(1243.68);});
 it('dodaje PDV samo jednom kod neto cena',()=>{const c=calculate(job(),defaults);expect(c.net).toBe(120);expect(c.tax).toBe(24);expect(c.total).toBe(144);});
 it('izdvaja PDV iz već bruto unetih cena',()=>{const c=calculate(job(),{...defaults,vatMode:'inclusive'});expect(c.net).toBe(100);expect(c.tax).toBe(20);expect(c.total).toBe(120);});
 it('primenjuje popust pre PDV-a i na transport',()=>{const c=calculate({...job(),discount:10},defaults);expect(c.discount).toBe(12);expect(c.total).toBeCloseTo(129.6);});
 it('podržava isključen porez i nultu ručnu cenu',()=>{const j=job();j.positions[0].manualPrice=0;const c=calculate(j,{...defaults,vatMode:'none'});expect(c.total).toBe(20);expect(c.tax).toBe(0);});
 it('paketi menjaju samo cenu profila',()=>{const p=makePosition();expect(positionCost(p,defaults,'Premium').unit-positionCost(p,defaults).unit).toBeCloseTo(2.24*110*.28);p.manualPrice=300;expect(positionCost(p,defaults,'Premium').unit).toBe(300);});
 it('fiksno zastakljenje nema cenu okova',()=>{const p=makePosition();p.segments.forEach(s=>s.opening='Fiksno');expect(positionCost(p,defaults).lines.find(l=>l.name==='Okov')!.amount).toBe(0);});
 it('proverava zbir širina, granice mera i količinu',()=>{const p=makePosition();expect(validatePosition(p)).toEqual([]);p.segments[0].width=1000;expect(validatePosition(p).join()).toContain('Zbir širina');p.width=0;p.quantity=1.5;expect(validatePosition(p).length).toBeGreaterThan(2);});
});
