import { describe, expect, it } from 'vitest';
import { calculate, defaults, positionCost, validatePosition } from './calculation';
import { makePosition } from '../catalog';
import { changeShutter, makeShutter } from '../shutters';
import type { Job, Position } from '../models';
const job = ():Job=>({id:'TEST',customer:{name:'Petrović',phone:'',email:'',address:'Pančevo',building:'Kuća'},date:'2026-11-01',technician:'Majstor',notes:'',status:'U izradi',positions:[{...makePosition(),manualPrice:100}],package:'Standard',discount:0,transport:20,extraWork:'',extraCost:0,validity:'15 dana',delivery:'Dogovor',payment:'Avans',updated:''});
describe('Demonstraciona kalkulacija',()=>{
 it('kombinuje površinu, broj krila, kip okov, obim i količinu',()=>{const p=makePosition();expect(positionCost(p,defaults).unit).toBeCloseTo(432.08);p.quantity=2;p.shutter=true;p.mosquito=true;p.removal=true;expect(positionCost(p,defaults).total).toBeCloseTo(1267.68);});
 it('računa ram i roletnu po njihovim merama i primenjuje cenu izabranog tipa',()=>{
  const p=makePosition();
  const settings={...defaults,prices:{...defaults.prices,shutterTop:60,shutterFacade:55}};
  const top={...p,...changeShutter(p,makeShutter('top'))};
  expect(top.height).toBe(1200);
  expect(positionCost(top,settings).area).toBeCloseTo(1.92);
  expect(positionCost(top,settings).lines.find(line=>line.name==='Roletna')?.amount).toBeCloseTo(134.4);
  const facade={...top,...changeShutter(top,{...makeShutter('facade'),width:1700})};
  expect(facade.height).toBe(1400);
  expect(positionCost(facade,settings).lines.find(line=>line.name==='Roletna')?.amount).toBeCloseTo(146.3275);
 });
 it('dodaje PDV samo jednom kod neto cena',()=>{const c=calculate(job(),defaults);expect(c.net).toBe(120);expect(c.tax).toBe(24);expect(c.total).toBe(144);});
 it('izdvaja PDV iz već bruto unetih cena',()=>{const c=calculate(job(),{...defaults,vatMode:'inclusive'});expect(c.net).toBe(100);expect(c.tax).toBe(20);expect(c.total).toBe(120);});
 it('primenjuje popust pre PDV-a i na transport',()=>{const c=calculate({...job(),discount:10},defaults);expect(c.discount).toBe(12);expect(c.total).toBeCloseTo(129.6);});
 it('podržava isključen porez i nultu ručnu cenu',()=>{const j=job();j.positions[0].manualPrice=0;const c=calculate(j,{...defaults,vatMode:'none'});expect(c.total).toBe(20);expect(c.tax).toBe(0);});
 it('dodaje maržu automatskoj ceni po komadu uz ručni unos i transport',()=>{
  const j=job();
  const auto={...makePosition(),quantity:2};
  j.positions.push(auto);
  const settings={...defaults,prices:{...defaults.prices,marginPercent:20}};
  const result=calculate(j,settings);
  expect(result.positions[0].unit).toBe(100);
  expect(result.positions[1].unit).toBe(518.50);
  expect(result.positions[1].lines.find(line=>line.name==='Marža')?.amount).toBe(86.42);
  expect(result.net).toBe(1157);
  expect(result.total).toBeCloseTo(1388.4);
 });
 it('paketi menjaju samo cenu profila',()=>{const p=makePosition();expect(positionCost(p,defaults,'Premium').unit-positionCost(p,defaults).unit).toBeCloseTo(2.24*110*.28);p.manualPrice=300;expect(positionCost(p,defaults,'Premium').unit).toBe(300);});
 it('fiksno zastakljenje nema cenu okova',()=>{const p=makePosition();p.segments.forEach(s=>s.opening='Fiksno');expect(positionCost(p,defaults).lines.find(l=>l.name==='Okov')!.amount).toBe(0);});
 it('proverava zbir širina, granice mera i količinu',()=>{const p=makePosition();expect(validatePosition(p)).toEqual([]);p.segments[0].width=1000;expect(validatePosition(p).join()).toContain('Zbir širina');p.width=0;p.quantity=1.5;expect(validatePosition(p).length).toBeGreaterThan(2);});
 it('izostavlja prazno polje i deli površinu kombinovane ispune',()=>{
  const p:Position={...makePosition(),width:2000,height:1000,modelLayout:{system:'Portal',rows:[{weight:1,cells:[{movement:'fixed',infill:'space',weight:1},{movement:'right',infill:'glassPanel',weight:1}]}]}};
  const price=positionCost(p,defaults);
  expect(price.area).toBe(1);
  expect(price.perimeter).toBe(4);
  expect(price.lines.find(line=>line.name==='Dvoslojno staklo')?.amount).toBeCloseTo(.62*32);
  expect(price.lines.find(line=>line.name==='Puni panel')?.amount).toBeCloseTo(.38*65);
 });
});
