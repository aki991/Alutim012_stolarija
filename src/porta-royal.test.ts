import { describe, expect, it } from 'vitest';
import { makePosition } from './catalog';
import { isPortaRoyalConfig, portaConfiguration, portaRoyalGroups, portaRoyalSeries, portaRoyalTypes, portaVariant, portaVariantCount, type PortaType } from './porta-royal';
import { defaults, positionCost } from './services/calculation';

describe('Porta Royal',()=>{
 it('čuva sve javne kombinacije konfiguratora, uključujući različite ponude dve CPL serije',()=>{
  expect(Object.keys(portaRoyalGroups)).toHaveLength(7);
  expect(portaRoyalSeries).toHaveLength(15);
  expect(portaVariantCount).toBe(814);
  expect(Object.keys(portaRoyalTypes)).toHaveLength(17);
  expect(new Set(portaRoyalSeries.flatMap(series=>series.decors.map(decor=>decor.id))).size).toBe(23);
  for(const series of portaRoyalSeries)for(const key of Object.keys(series.variants)){
   const [decor,type]=key.split('/');
   const config=portaConfiguration({series:series.id,decor,type:type as PortaType});
   expect(isPortaRoyalConfig(config)).toBe(true);
   expect(portaVariant(config)?.image).toMatch(/^20\d\d\/\d\d\//);
  }
  expect(portaVariant({series:'eko-furnir-lux-classic',decor:'nordijski-hrast',type:'k'})?.id).toBe(5626);
  expect(portaVariant({series:'cpl-bela',decor:'matrix',type:'s'})).toBeUndefined();
  expect(portaVariant({series:'cpl-bela-premium',decor:'bela',type:'n'})).toBeUndefined();
 });

 it('obračunava cenu dobavljača po komadu uz postojeću maržu i ručnu cenu',()=>{
  const portaRoyal=portaConfiguration({series:'siena',decor:'lipa',type:'s'});
  const p={...makePosition(),portaRoyal,quantity:2,installation:false};
  expect(positionCost(p,defaults).requiresReview).toBe(true);
  const settings={...defaults,portaRoyalPrices:{siena:180},prices:{...defaults.prices,marginPercent:20}};
  const priced=positionCost(p,settings,'Premium');
  expect(priced.lines.map(line=>line.name)).toEqual(['Porta Royal Siena','Marža']);
  expect(priced.total).toBe(432);
  expect(positionCost({...p,manualPrice:150},defaults).total).toBe(300);
 });
});
