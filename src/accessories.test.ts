import { describe, expect, it } from 'vitest';
import { makeFieldPosition } from './field-types';
import { makePosition } from './catalog';
import { accessoryDimensionPatch, accessorySize, isAccessoryDimensions, resetAccessoryDimensions } from './accessories';
import { defaults, positionCost, validatePosition } from './services/calculation';
import { parseStoredPosition } from './services/storage';

describe('Mere dodatne opreme',()=>{
 it('komarnik prati mere elementa umanjene za 50 mm i 10 mm, a ručne mere ostaju fiksne',()=>{
  const p=makePosition();expect(accessorySize(p,'mosquito')).toEqual({width:1550,height:1390});
  const changed={...p,width:1800,height:1600};expect(accessorySize(changed,'mosquito')).toEqual({width:1750,height:1590});
  const manual={...p,...accessoryDimensionPatch(p,'mosquito','width',1500),width:1900,height:1700};
  expect(accessorySize(manual,'mosquito')).toEqual({width:1500,height:1690});
  expect(accessorySize({...manual,...resetAccessoryDimensions(manual,'mosquito')},'mosquito')).toEqual({width:1850,height:1690});
 });
 it('klupica i okapnica imaju zasebne dužine i dubine, sa čuvanjem svih dodataka',()=>{
  const p={...makePosition(),mosquito:true,sill:true,drip:true,
   accessoryDimensions:{mosquito:{width:1500,height:1300},sill:{width:1700,height:250},drip:{width:1650,height:80}}};
  const stored=parseStoredPosition(JSON.parse(JSON.stringify(p)));
  expect(stored.accessoryDimensions).toEqual(p.accessoryDimensions);expect(stored.drip).toBe(true);
  const reset={...stored,...resetAccessoryDimensions(stored,'sill')};
  expect(accessorySize(reset,'sill')).toEqual({width:1600,height:undefined});
  expect(accessorySize(reset,'drip')).toEqual({width:1650,height:80});
  const cleared={...p,...accessoryDimensionPatch(p,'sill','height',undefined)};
  expect(accessorySize(cleared,'sill')).toEqual({width:1700,height:undefined});
 });
 it('obračun koristi stvarne mere dodataka i ne pretpostavlja cenu okapnice',()=>{
  const p={...makePosition(),mosquito:true,sill:true,drip:true,
   accessoryDimensions:{mosquito:{width:1000,height:1200},sill:{width:1800,height:250},drip:{width:1700,height:80}}};
  const priced=positionCost(p,{...defaults,prices:{...defaults.prices,drip:12}});
  expect(priced.lines.find(line=>line.name==='Komarnik')?.amount).toBeCloseTo(31.2);
  expect(priced.lines.find(line=>line.name==='Klupica')?.amount).toBeCloseTo(28.8);
  expect(priced.lines.find(line=>line.name==='Okapnica')?.amount).toBeCloseTo(20.4);
  expect(priced.requiresReview).toBe(false);
  expect(positionCost(p,defaults).requiresReview).toBe(true);
  expect(positionCost({...p,manualPrice:700},defaults).total).toBe(700);
 });
 it('čuva neispravan nacrt, blokira potvrdu pogrešnih mera i prihvata ranije pozicije',()=>{
  const p={...makePosition(),mosquito:true,accessoryDimensions:{mosquito:{width:0,height:1300}}};
  expect(validatePosition(p)).toContain('Komarnik: unesite mere od 1 do 20000 mm.');
  expect(parseStoredPosition(JSON.parse(JSON.stringify(p))).accessoryDimensions).toEqual(p.accessoryDimensions);
  for(const bad of [null,[],{bad:{width:1}},{sill:{depth:100}},{mosquito:{width:'1500'}},{drip:{width:Infinity}}])expect(isAccessoryDimensions(bad)).toBe(false);
  const old=makePosition();delete old.drip;expect(parseStoredPosition(old).drip).toBeUndefined();
 });
 it('obračunava motor komarnika jednom po komadu, za dodatak i samostalni element',()=>{
  const settings={...defaults,prices:{...defaults.prices,mosquitoMotor:75}};
  for(const source of [{...makePosition(),mosquito:true},makeFieldPosition('komarnik')]){
   const p={...source,mosquitoMotor:true,quantity:3};
   const cost=positionCost(p,settings),without=positionCost({...p,mosquitoMotor:false},settings);
   expect(cost.lines.find(line=>line.name==='Motor za komarnik')?.amount).toBe(75);
   expect(cost.total-without.total).toBeCloseTo(225);
   expect(positionCost(p,defaults).requiresReview).toBe(true);
   expect(parseStoredPosition(JSON.parse(JSON.stringify(p))).mosquitoMotor).toBe(true);
  }
  expect(positionCost({...makePosition(),mosquitoMotor:true},defaults).requiresReview).toBe(false);
 });

});
