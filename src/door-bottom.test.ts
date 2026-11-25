import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { makeFieldPosition } from './field-types';
import { catalogModels } from './catalog-models';
import { aluThresholdMm, doorBottomSpans, supportsDoorBottom } from './door-bottom';
import { Drawing } from './components/Drawing';
import { parseStoredPosition } from './services/storage';
import { defaults, positionCost, validatePosition } from './services/calculation';
import { presetGeometry } from './custom/geometry';

describe('Donji deo vrata',()=>{
 it('čuva oba izbora bez dodavanja 24 mm na ukupnu visinu i prihvata stare pozicije',()=>{
  const p=makeFieldPosition('vrata');
  expect(parseStoredPosition(p).doorBottom).toBeUndefined();
  for(const mode of ['alu24','frame'] as const){
   const saved=parseStoredPosition(JSON.parse(JSON.stringify({...p,doorBottom:mode})));
   expect(saved.doorBottom).toBe(mode);expect(saved.height).toBe(2100);
   expect(validatePosition(saved)).toEqual([]);
   expect(positionCost(saved,defaults)).toEqual(positionCost(p,defaults));
   const svg=renderToStaticMarkup(createElement(Drawing,{position:saved}));
   expect(svg).toContain('1000 puta 2100 milimetara');
   expect(svg).toContain(`data-door-bottom="${mode}"`);
   expect(svg.includes('data-threshold-mm="24"')).toBe(mode==='alu24');
  }
  for(const doorBottom of ['unknown',null,24,['alu24'],{}])expect(()=>parseStoredPosition({...p,doorBottom})).toThrow();
 });
 it('prag pripada samo vratima u kombinaciji, nezavisno od strane i visine prozora',()=>{
  const p=makeFieldPosition('kombinacija');
  expect(doorBottomSpans(p)).toEqual([{x:0,width:900}]);
  expect(doorBottomSpans({...p,combination:{...p.combination!,windowSide:'left',windowHeight:1200}})).toEqual([{x:900,width:900}]);
  const svg=renderToStaticMarkup(createElement(Drawing,{position:{...p,doorBottom:'alu24'}}));
  expect(svg.match(/data-threshold-mm="24"/g)).toHaveLength(1);
 });
 it('kod kataloškog modela ne postavlja prag ispod bočnih fiksnih polja',()=>{
  const model=catalogModels.find(model=>model.id==='d-balcony-panel-sides-double')!;
  expect(model).toBeDefined();
  const p=makeFieldPosition('model',undefined,model.id);
  const spans=doorBottomSpans(p);
  expect(spans).toEqual([{x:430,width:850},{x:1280,width:850}]);
  const svg=renderToStaticMarkup(createElement(Drawing,{position:{...p,doorBottom:'alu24'}}));
  expect(svg.match(/data-threshold-mm="24"/g)).toHaveLength(2);
  expect(svg).toContain('#ddd9d1');
  expect(svg).toContain('data-model-movement="left"');
 });
 it('podržava nacrtana vrata sa ravnim dnom i ne nudi izbor prozorima i roletnama',()=>{
  const p={...makeFieldPosition('nacrtaj'),category:'Vrata' as const,customKind:'door' as const,customGeometry:presetGeometry('arch',1000,2100),width:1000,height:2100,doorBottom:'alu24' as const};
  expect(supportsDoorBottom(p)).toBe(true);
  const svg=renderToStaticMarkup(createElement(Drawing,{position:p}));
  expect(svg).toContain(`data-threshold-mm="${aluThresholdMm}"`);
  for(const type of ['prozor','roletna','komarnik','klizni'])expect(supportsDoorBottom(makeFieldPosition(type))).toBe(false);
 });
});
