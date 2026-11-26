import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { makeFieldPosition } from './field-types';
import { catalogModels } from './catalog-models';
import { aluThresholdMm, doorBottomSpans, openDoorFramePath, supportsDoorBottom } from './door-bottom';
import { Drawing } from './components/Drawing';
import { parseStoredPosition } from './services/storage';
import { defaults, positionCost, validatePosition } from './services/calculation';
import { presetGeometry } from './custom/geometry';
import { positionMeasures } from './services/position-measures';
import { portaConfiguration, portaDefaultSelection, portaRoyalSeries } from './porta-royal';

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
  for(const type of ['prozor','roletna','komarnik'])expect(supportsDoorBottom(makeFieldPosition(type))).toBe(false);
 });
 it('čuva Bez praga i uklanja samo donji profil, bez promene mera ili krila',()=>{
  for(const type of ['vrata','balkonska','klizni','kombinacija']){
   const p=makeFieldPosition(type),before=structuredClone(p),saved=parseStoredPosition(JSON.parse(JSON.stringify({...p,doorBottom:'none'})));
   expect(supportsDoorBottom(saved)).toBe(true);expect(saved.doorBottom).toBe('none');expect(validatePosition(saved)).toEqual([]);
   expect(saved.height).toBe(p.height);expect(saved.width).toBe(p.width);expect(saved.segments).toEqual(p.segments);
   const original=positionMeasures(p)!,open=positionMeasures(saved)!;
   expect(original.frame-open.frame).toBeCloseTo(doorBottomSpans(p).reduce((n,span)=>n+span.width,0)/1000,8);
   expect(open.area).toBe(original.area);expect(open.sash).toBe(original.sash);
   const svg=renderToStaticMarkup(createElement(Drawing,{position:saved}));
   expect(svg).toContain('data-open-door-frame="true"');expect(svg).toContain('data-door-bottom="none"');expect(svg).not.toContain('data-threshold-mm');expect(svg).toContain('Bez praga');
   expect(p).toEqual(before);
  }
 });
 it('svi kataloški modeli vrata nude izbor, uključujući klizna i sklopiva vrata',()=>{
  for(const model of catalogModels.filter(model=>['Vrata','Ulazna vrata','Klizni sistemi','Sobna vrata'].includes(model.category))){
   const p=makeFieldPosition('model',undefined,model.id);
   expect(supportsDoorBottom(p),model.id).toBe(true);
   const saved=parseStoredPosition({...p,doorBottom:'none'});expect(validatePosition(saved),model.id).toEqual([]);
   expect(renderToStaticMarkup(createElement(Drawing,{position:saved,compact:true})),model.id).toContain('data-open-door-frame="true"');
  }
 });
 it('ostavlja donji ram ispod bočnih fiksnih polja',()=>{
  expect(openDoorFramePath({x:10,y:20,width:100,height:200},[{x:30,width:50}])).toBe('M10 220V20H110V220M10 220H30M80 220H110');
  expect(openDoorFramePath({x:0,y:0,width:100,height:200},[{x:50,width:50},{x:0,width:50}])).toBe('M0 200V0H100V200');
 });
 it('nacrtana vrata ostaju zatvorena kontura, ali nemaju donji profil rama',()=>{
  const geometry=presetGeometry('trapezoid',1200,2100),p={...makeFieldPosition('nacrtaj'),customKind:'door' as const,customGeometry:geometry,width:1200,height:2100,doorBottom:'none' as const};
  const saved=parseStoredPosition(p),svg=renderToStaticMarkup(createElement(Drawing,{position:saved}));
  expect(saved.customGeometry).toEqual(geometry);expect(validatePosition(saved)).toEqual([]);
  expect(svg).toMatch(/d="M0 2100 L0 525\s+L1200 0\s+L1200 2100" data-open-door-frame="true"/);
  expect(positionMeasures({...p,doorBottom:'frame'})!.frame-positionMeasures(p)!.frame).toBeCloseTo(1.2,8);
 });
 it('podržava i sobna vrata Porta Royal',()=>{
  const p={...makeFieldPosition('vrata'),category:'Sobna vrata' as const,elementType:'sobna-vrata',portaRoyal:portaConfiguration(portaDefaultSelection(portaRoyalSeries[0])),doorBottom:'none' as const};
  expect(supportsDoorBottom(p)).toBe(true);expect(parseStoredPosition(p).doorBottom).toBe('none');
  const svg=renderToStaticMarkup(createElement(Drawing,{position:p}));expect(svg).toContain('data-open-door-frame="true"');expect(svg).toContain('Bez praga');expect(svg).not.toContain('data-threshold-mm');
 });
});
