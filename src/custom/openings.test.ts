import { describe, expect, it } from 'vitest';
import { presetGeometry } from './geometry';
import { openingRegions, regionContains } from './openings';

describe('Polja ručno nacrtanog elementa', () => {
 it('nalazi dva polja trapeza i treće nakon prečke do postojeće prečke', () => {
  const g = presetGeometry('trapezoid');
  expect(openingRegions(g)).toHaveLength(1);
  g.bars.push({id:'vertical',a:{x:1200,y:200},b:{x:1200,y:1600}});
  const split = openingRegions(g);
  expect(split).toHaveLength(2);
  g.bars.push({id:'horizontal',a:{x:1200,y:800},b:{x:2400,y:800}});
  const regions = openingRegions(g);
  expect(regions).toHaveLength(3);
  expect(regions[0].id).toBe(split[0].id);
  for (const point of [{x:600,y:900},{x:1800,y:500},{x:1800,y:1200}]) {
   expect(regions.filter(region=>regionContains(region,point))).toHaveLength(1);
  }
 });
 it('povezuje prečku na zakrivljenu ivicu', () => {
  const g = presetGeometry('arch');
  g.bars.push({id:'middle',a:{x:1200,y:0},b:{x:1200,y:1600}});
  expect(openingRegions(g)).toHaveLength(2);
 });
});
