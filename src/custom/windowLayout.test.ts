import { describe, expect, it } from 'vitest';
import { presetGeometry } from './geometry';
import { openingRegions, regionContains } from './openings';
import { archTopOffset, divideWindow } from './windowLayout';

describe('Podela prozora na polja', () => {
 it('pravi četiri fiksna polja i dva odvojena srednja polja', () => {
  const g = divideWindow(presetGeometry('rectangle',2400,1600),{top:300,bottom:250,left:250,right:350},2);
  const regions = openingRegions(g);
  expect(g.bars).toHaveLength(5);
  expect(regions).toHaveLength(6);
  const positions = [{x:1200,y:100},{x:1200,y:1500},{x:100,y:800},{x:2200,y:800},{x:600,y:800},{x:1600,y:800}];
  const ids = positions.map(point=>regions.find(region=>regionContains(region,point))?.id);
  expect(ids).not.toContain(undefined);
  expect(new Set(ids).size).toBe(6);
 });

 it('odvaja luk na tačnoj visini i ostavlja pravougaono donje polje', () => {
  const arch = presetGeometry('arch',2400,2545);
  const top = archTopOffset(arch);
  expect(top).toBe(1200);
  const g = divideWindow(arch,{top,bottom:0,left:0,right:0},1);
  const regions = openingRegions(g);
  expect(regions).toHaveLength(2);
  const lower = regions.find(region=>regionContains(region,{x:1200,y:1800}));
  expect(lower?.points).toHaveLength(4);
  expect(lower?.points.map(point=>point.y).sort((a,b)=>a-b)).toEqual([1200,1200,2545,2545]);
 });
});
