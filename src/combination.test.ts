import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { makeFieldPosition } from './field-types';
import type { Position } from './models';
import { combinationParts, mainLeafIndices, mainLeafText, resizePart, resizePartLeaf, setPartLeafCount } from './combination';
import { changePositionDimension, positionDimensions } from './position-dimensions';
import { doorBottomSpans } from './door-bottom';
import { positionMeasures } from './services/position-measures';
import { validatePosition } from './services/calculation';
import { parseStoredPosition } from './services/storage';
import { Drawing } from './components/Drawing';

const apply=(p:Position,patch:Partial<Position>)=>({...p,...patch});
const doubleBoth=()=>{
 let p=makeFieldPosition('kombinacija');
 p=apply(p,resizePart(p,'door',1400));
 p=apply(p,setPartLeafCount(p,'door',2));
 p=apply(p,resizePart(p,'window',1200));
 return apply(p,setPartLeafCount(p,'window',2));
};

describe('kombinacija sa jednokrilnim i dvokrilnim delovima',()=>{
 it('podržava sve kombinacije broja krila i čuva širinu dela',()=>{
  for(const door of [1,2])for(const window of [1,2]){
   let p=makeFieldPosition('kombinacija');
   p=apply(p,setPartLeafCount(p,'door',door));
   p=apply(p,setPartLeafCount(p,'window',window));
   const parts=combinationParts(p);
   expect([parts.doorLeaves,parts.windowLeaves]).toEqual([door,window]);
   expect([parts.doorWidth,parts.windowWidth,p.width]).toEqual([900,900,1800]);
   expect(validatePosition(p)).toEqual([]);
   expect(parseStoredPosition(JSON.parse(JSON.stringify(p))).segments).toHaveLength(door+window);
   expect(positionMeasures(p)!.openings.filter(o=>o.door)).toHaveLength(door);
   expect(positionMeasures(p)!.openings.filter(o=>!o.door)).toHaveLength(window);
  }
 });
 it('menja širinu dela i krila preko kota',()=>{
  const p=doubleBoth();
  expect(positionDimensions(p).map(d=>d.id)).toEqual(expect.arrayContaining(['part:door','leaf:door:0','leaf:door:1','part:window','leaf:window:0','leaf:window:1']));
  let next=changePositionDimension(p,'leaf:door:0',800);
  expect(next.segments.map(s=>s.width)).toEqual([800,600,600,600]);
  next=changePositionDimension(next,'part:window',1500);
  expect(next.segments.map(s=>s.width)).toEqual([800,600,750,750]);
  expect(next.width).toBe(2900);
  expect(validatePosition(next)).toEqual([]);
  expect(resizePartLeaf(next,'window',1,500).segments!.map(s=>s.width)).toEqual([800,600,1000,500]);
 });
 it('prag ostaje ispod celih dvokrilnih vrata i kad je prozor levo',()=>{
  const p=doubleBoth();
  expect(doorBottomSpans({...p,combination:{...p.combination!,windowSide:'left'}})).toEqual([{x:1200,width:1400}]);
 });
 it('crta dva krila u svakom delu',()=>{
  const svg=renderToStaticMarkup(createElement(Drawing,{position:doubleBoth()}));
  expect(svg.match(/aria-label="Krilo \d/g)).toHaveLength(4);
  expect(svg.match(/data-combination-part=/g)).toHaveLength(2);
 });
 it('čita stare kombinacije bez broja krila kao jednokrilne',()=>{
  const p=makeFieldPosition('kombinacija');
  delete p.combination!.doorLeaves;
  expect(combinationParts(p)).toMatchObject({doorLeaves:1,windowLeaves:1,doorWidth:900,windowWidth:900});
  expect(()=>parseStoredPosition({...p,combination:{...p.combination,doorLeaves:3}})).toThrow();
 });
});

describe('glavno krilo dvokrilnih vrata',()=>{
 it('bez izbora su oba krila glavna, a izbor ostavlja jedno',()=>{
  const p={...makeFieldPosition('vrata'),segments:[{width:850,opening:'Levo' as const},{width:1350,opening:'Desno' as const}],width:2200};
  expect(mainLeafIndices(p)).toEqual([0,1]);
  expect(mainLeafText(p)).toBe('Glavno krilo: oba krila glavna');
  expect(mainLeafIndices({...p,mainLeaf:'left'})).toEqual([0]);
  expect(mainLeafIndices({...p,mainLeaf:'right'})).toEqual([1]);
  const svg=renderToStaticMarkup(createElement(Drawing,{position:{...p,mainLeaf:'right'}}));
  expect(svg.match(/data-main-leaf=/g)).toHaveLength(1);
  expect(mainLeafIndices({...p,segments:[p.segments[0]],width:850})).toEqual([]);
  expect(()=>parseStoredPosition({...p,mainLeaf:'middle'})).toThrow();
 });
 it('važi za dvokrilna vrata u kombinaciji',()=>{
  const p=doubleBoth();
  expect(mainLeafIndices({...p,mainLeaf:'left'})).toEqual([0]);
  expect(setPartLeafCount({...p,mainLeaf:'left'},'door',1).mainLeaf).toBeUndefined();
  expect(mainLeafIndices(makeFieldPosition('kombinacija'))).toEqual([]);
 });
});
