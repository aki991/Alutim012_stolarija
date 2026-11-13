import { describe, expect, it } from 'vitest';
import { catalogModels, modelGroups } from './catalog-models';
import { makeFieldPosition } from './field-types';
import { contourAngles } from './custom/geometry';
import { isModelLayout, resizeBand, weightTotal } from './model-layout';
import { defaults, positionCost, validatePosition } from './services/calculation';
import { parseBackup } from './services/storage';
import type { Job } from './models';

describe('Prošireni katalog',()=>{
 it('otvara svaku dostupnu tipologiju sa validnim merama i jedinstvenom oznakom',()=>{
  expect(catalogModels.length).toBeGreaterThan(1000);
  expect(new Set(catalogModels.map(model=>model.id)).size).toBe(catalogModels.length);
  expect(new Set(catalogModels.map(model=>model.group)).size).toBe(Object.keys(modelGroups).length);
  for(const model of catalogModels){
   const position=makeFieldPosition(model.shape?'nacrtaj':'model',undefined,model.id);
   expect(validatePosition(position),model.id).toEqual([]);
   const price=positionCost(position,defaults);
   expect(Number.isFinite(price.unit)&&price.unit>0&&!price.requiresReview,model.id).toBe(true);
   if(model.layout)expect(isModelLayout(position.modelLayout),model.id).toBe(true);
  }
 });

 it('čuva model kao samostalnu poziciju i obračunava unesenu ručnu cenu',()=>{
  const position=makeFieldPosition('model',undefined,'s-corner-hs-2-3');
  const job:Job={id:'test',customer:{name:'Kupac',phone:'',email:'',address:'',building:''},date:'',technician:'Majstor',notes:'',status:'U izradi',positions:[position],package:'Standard',discount:0,transport:0,extraWork:'',extraCost:0,validity:'',delivery:'',payment:'',updated:''};
  const stored=parseBackup(JSON.parse(JSON.stringify({settings:defaults,jobs:[job]}))).jobs[0].positions[0];
  expect(stored.modelLayout?.cornerAfter).toBe(2);
  expect(stored.modelLayout?.rows[0].cells).toHaveLength(5);
  expect(positionCost(stored,defaults).lines.find(line=>line.name.includes('(HS)'))?.amount).toBe(150);
  expect(positionCost({...stored,manualPrice:650,quantity:2},defaults).total).toBe(1300);
 });

 it('čuva ukupnu meru i odnos susednih polja pri promeni širine',()=>{
  const resized=resizeBand([{weight:2},{weight:3},{weight:1}],1,400,1000);
  expect(resized.map(field=>field.weight)).toEqual([400,400,200]);
  expect(weightTotal(resized)).toBe(1000);
 });

 it('prikazuje elipsu bez uglova na spojevima aproksimiranih lukova',()=>{
  const ellipse=makeFieldPosition('nacrtaj',undefined,'shape-ellipse').customGeometry!;
  expect(contourAngles(ellipse)).toEqual([]);
 });
});
