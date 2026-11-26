import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { makeFieldPosition } from './field-types';
import { changePositionDimension, positionDimensions } from './position-dimensions';
import { panelHeightOf, weightTotal } from './model-layout';
import { Drawing } from './components/Drawing';
import { defaults, positionCost, validatePosition } from './services/calculation';
import { parseStoredPosition } from './services/storage';
import { positionMeasures } from './services/position-measures';

const model=()=>makeFieldPosition('model',undefined,'d-balcony-panel-top-sides-double');
const value=(p:ReturnType<typeof model>,id:string)=>positionDimensions(p).find(d=>d.id===id)!.value;

describe('Izmena mera preko kota vrata',()=>{
 it('menja parapet i staklo nezavisno za svako krilo, uz isti zbir visina',()=>{
  const p=model(),before=structuredClone(p);
  const changed=changePositionDimension(p,'panel:1:1',550);
  expect(value(changed,'panel:1:1')).toBe(550);expect(value(changed,'glass:1:1')).toBe(1550);
  expect(value(changed,'panel:1:2')).toBe(798);
  expect(p).toEqual(before);expect(changed.height).toBe(2450);
  const glass=changePositionDimension(changed,'glass:1:1',1475);
  expect(value(glass,'panel:1:1')).toBe(625);
  expect(renderToStaticMarkup(createElement(Drawing,{position:glass}))).toContain('data-model-panel="1.1"');
  expect(validatePosition(glass)).toEqual([]);
 });
 it('mere redova i širine polja zadržavaju ukupnu meru i zbir delova',()=>{
  let p=changePositionDimension(model(),'panel:1:1',550);
  p=changePositionDimension(p,'row:0',400);
  expect(value(p,'row:1')).toBe(2050);expect(value(p,'glass:1:1')).toBe(1500);
  p=changePositionDimension(p,'cell:1:1',900);
  const row=p.modelLayout!.rows[1],widths=row.cells.map(cell=>p.width*cell.weight/weightTotal(row.cells));
  expect(widths[1]).toBeCloseTo(900);expect(widths.reduce((a,b)=>a+b)).toBeCloseTo(2560);
  expect(p.modelLayout!.rows.reduce((n,row)=>n+p.height*row.weight/weightTotal(p.modelLayout!.rows),0)).toBeCloseTo(2450);
  expect(panelHeightOf(row.cells[1],2050)).toBe(550);
 });
 it('stvarne površine stakla i panela ulaze u cenu i sačuvanu poziciju',()=>{
  const p=model(),changed=changePositionDimension(p,'panel:1:1',500.5);
  const old=positionMeasures(p)!,next=positionMeasures(changed)!;
  expect(next.area).toBeCloseTo(old.area);
  expect(next.panel).toBeCloseTo(old.panel-(798-500.5)*850/1e6);
  expect(next.glass).toBeCloseTo(old.glass+(798-500.5)*850/1e6);
  expect(positionCost(changed,defaults).total).not.toBe(positionCost(p,defaults).total);
  const saved=parseStoredPosition(JSON.parse(JSON.stringify(changed)));
  expect(saved).toEqual(changed);expect(value(saved,'panel:1:1')).toBe(500.5);
  expect(parseStoredPosition(p).modelLayout!.rows[1].cells[1].panelHeight).toBeUndefined();
 });
 it('ne prihvata nevažeću meru i blokira prenizak red za sačuvani parapet',()=>{
  const p=model();
  for(const n of [NaN,0,-1,2100,Infinity])expect(()=>changePositionDimension(p,'panel:1:1',n)).toThrow();
  expect(()=>changePositionDimension(p,'unknown',100)).toThrow();
  const next=changePositionDimension(changePositionDimension(p,'panel:1:1',1900),'row:0',1000);
  expect(validatePosition(next)).toContain('Visina parapeta mora biti manja od visine polja; za staklo mora ostati najmanje 1 mm.');
  expect(positionMeasures(next)).toBeNull();
  for(const bad of [null,'600',0,-10,Infinity]){
   const invalid=structuredClone(p);Object.assign(invalid.modelLayout!.rows[1].cells[1],{panelHeight:bad});
   expect(()=>parseStoredPosition(invalid)).toThrow();
  }
 });
 it('menja fiksno polje i širine krila bez promene ukupnih mera',()=>{
  const p={...makeFieldPosition('vrata'),width:1800,fixedPanels:{top:300,bottom:0,left:200,right:200},segments:[{width:700,opening:'Levo' as const},{width:700,opening:'Desno' as const}]};
  let next=changePositionDimension(p,'fixed:left',300);
  expect(next.segments.map(s=>s.width)).toEqual([650,650]);
  next=changePositionDimension(next,'segment:0',800);
  expect(next.segments.map(s=>s.width)).toEqual([800,500]);
  next=changePositionDimension(next,'middleHeight',1700);
  expect(next.fixedPanels?.top).toBe(400);expect(next.height).toBe(2100);
  expect(validatePosition(next)).toEqual([]);
  const single=changePositionDimension({...p,segments:[{width:1400,opening:'Levo'}]},'segment:0',1500);
  expect(single.width).toBe(1900);expect(single.fixedPanels).toEqual(p.fixedPanels);
  expect(validatePosition(single)).toEqual([]);
 });
 it('menja prozor u kombinaciji i čuva ukupnu visinu sa ALU pragom',()=>{
  const p={...makeFieldPosition('kombinacija'),doorBottom:'alu24' as const};
  let next=changePositionDimension(p,'part:door',950);
  expect(next.width).toBe(1850);expect(next.segments[1].width).toBe(900);
  next=changePositionDimension(next,'windowHeight',1300);
  expect(next.combination!.windowHeight).toBe(1300);expect(next.height).toBe(2100);
  expect(next.doorBottom).toBe('alu24');expect(validatePosition(next)).toEqual([]);
 });
});
