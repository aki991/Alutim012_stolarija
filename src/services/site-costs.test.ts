import { describe, expect, it } from 'vitest';
import type { Job } from '../models';
import { catalog, makePosition } from '../catalog';
import { calculate, defaults, positionCost, positionCostInJob } from './calculation';
import { isSiteCosts, spreadSiteCosts } from './site-costs';
import { parseBackup } from './storage';

const job=():Job=>({id:'AT-TEST',customer:{name:'Kupac',phone:'',email:'',address:'',building:''},date:'',technician:'Majstor',notes:'',status:'Merenje',positions:[{...makePosition(),manualPrice:400},{...makePosition(catalog[7]),manualPrice:500}],package:'Standard',discount:0,transport:35,siteCosts:{installation:100,travel:100},extraWork:'',extraCost:0,validity:'',delivery:'',payment:'',updated:'',vatMode:'none'});

describe('Montaža i put u cenama elemenata',()=>{
 it('primer 400 + 500 i 100 montaža + 100 put daje elemente 500 i 600',()=>{
  const c=calculate(job(),defaults);
  expect(c.positions.map(p=>p.unit)).toEqual([500,600]);
  expect(c.positions.map(p=>p.total)).toEqual([500,600]);
  expect(c.services).toBe(0);expect(c.elements).toBe(1100);expect(c.total).toBe(1100);
 });
 it('ukupna montaža zamenjuje automatsku montažu i ne dobija dodatnu maržu',()=>{
  const j=job();j.positions=j.positions.map(p=>({...p,manualPrice:null}));
  const settings={...defaults,prices:{...defaults.prices,marginPercent:20}};
  const c=calculate(j,settings);
  j.positions.forEach((p,i)=>{
   expect(c.positions[i].calculated).toBeCloseTo(positionCost({...p,installation:false},settings).calculated+100);
   expect(c.positions[i].lines.some(line=>line.name==='Montaža')).toBe(false);
  });
 });
 it('raspodeljuje po komadu, uz tačan zbir čak i kada preostane jedan cent',()=>{
  const j=job();j.positions[0].quantity=2;
  const c=calculate(j,defaults);
  expect(c.positions.map(p=>p.total)).toEqual([933.34,566.66]);expect(c.total).toBe(1500);
  for(const quantities of [[3,6],[2,1],[7,3,8],[100,99]])for(const cents of [1,10000,20000,19999]){
   const {shares}=spreadSiteCosts(cents,quantities);
   expect(shares.reduce((a,b)=>a+b,0)).toBe(cents);
   quantities.forEach((q,i)=>expect(Math.abs(shares[i]/q-cents/quantities.reduce((a,b)=>a+b,0))).toBeLessThanOrEqual(1));
  }
 });
 it('promena broja elemenata ponovo raspoređuje trošak i ne menja osnovne cene',()=>{
  const j=job(),snapshot=structuredClone(j);
  expect(calculate({...j,positions:[j.positions[1]]},defaults).positions[0].unit).toBe(700);
  const added={...makePosition(),manualPrice:300};
  const preview=positionCostInJob(j,added,defaults);
  expect(preview.unit).toBeCloseTo(366.66);
  expect(j).toEqual(snapshot);
 });
 it('ručno izmenjena prikazana cena ne dobija trošak drugi put pri ponovnom učitavanju',()=>{
  const j=job(),c=calculate(j,defaults);
  j.positions[0].manualPrice=550-c.positions[0].allocationUnit;
  const stored=parseBackup({jobs:[j],settings:defaults}).jobs[0];
  expect(calculate(stored,defaults).positions[0].unit).toBe(550);
  const changed=calculate({...stored,siteCosts:{installation:100,travel:200}},defaults);
  expect(changed.positions[0].unit).toBe(600);
 });
 it('popust i PDV primenjuje jednom na ukupan iznos sa uključenim troškovima',()=>{
  const c=calculate({...job(),discount:10,vatMode:'exclusive',vat:20},defaults);
  expect(c.discount).toBe(110);expect(c.net).toBe(990);expect(c.total).toBe(1188);
  expect(calculate({...job(),manualTotal:999},defaults).total).toBe(999);
 });
 it('zadržava zbir starih poslova i čuva nove troškove u rezervnoj kopiji',()=>{
  const j=job();delete j.siteCosts;
  expect(calculate(j,defaults).total).toBe(935);
  expect(calculate({...j,siteCosts:{travel:0}},defaults).total).toBe(900);
  expect(parseBackup({jobs:[job()],settings:defaults}).jobs[0].siteCosts).toEqual({installation:100,travel:100});
  for(const bad of [null,[],{installation:-1},{travel:'100'},{travel:Infinity},{extra:1}]){
   expect(isSiteCosts(bad)).toBe(false);
   expect(()=>parseBackup({jobs:[{...job(),siteCosts:bad}],settings:defaults})).toThrow();
  }
 });
});
