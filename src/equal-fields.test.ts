import { describe, expect, it } from 'vitest';
import { makeFieldPosition } from './field-types';
import type { Position } from './models';
import { equalizePosition, equalModesForPosition } from './equal-fields';
import { validatePosition } from './services/calculation';
import { weightTotal } from './model-layout';

const window3=():Position=>({...makeFieldPosition('prozor'),width:2400,segments:[{width:700,opening:'Levo'},{width:1000,opening:'Fiksno'},{width:700,opening:'Desno'}]});

describe('jednake širine polja',()=>{
 it('nudi opcije samo za više od dva polja',()=>{
  expect(equalModesForPosition({...makeFieldPosition('prozor'),segments:[{width:600,opening:'Levo'},{width:600,opening:'Desno'}]})).toEqual([]);
  expect(equalModesForPosition(window3())).toEqual(['all','opening']);
  expect(equalModesForPosition({...window3(),segments:[{width:500,opening:'Fiksno'},{width:1200,opening:'Levo'},{width:700,opening:'Fiksno'}]})).toEqual(['all','fixed']);
  expect(equalModesForPosition(makeFieldPosition('kombinacija'))).toEqual([]);
 });
 it('izjednačava sva polja ili samo jednu grupu bez promene ukupne širine',()=>{
  const p=window3();
  expect(equalizePosition(p,'all').segments!.map(s=>s.width)).toEqual([800,800,800]);
  const fixed={...p,segments:[{width:500,opening:'Fiksno' as const},{width:1200,opening:'Levo' as const},{width:700,opening:'Fiksno' as const}]};
  const next={...fixed,...equalizePosition(fixed,'fixed')};
  expect(next.segments.map(s=>s.width)).toEqual([600,1200,600]);
  expect(validatePosition(next)).toEqual([]);
  expect(equalizePosition({...p,width:2500,segments:[{width:700,opening:'Levo'},{width:1000,opening:'Fiksno'},{width:800,opening:'Desno'}]},'all').segments!.map(s=>s.width)).toEqual([833.33,833.33,833.34]);
 });
 it('bočna fiksna polja vrata ostaju u celim milimetrima',()=>{
  const door={...makeFieldPosition('vrata'),width:2101,fixedPanels:{top:0,bottom:0,left:300,right:501},segments:[{width:1300,opening:'Levo + kip' as const}]};
  const fixed={...door,...equalizePosition(door,'fixed')};
  expect(fixed.fixedPanels).toMatchObject({left:401,right:400});
  const all={...door,...equalizePosition(door,'all')};
  expect([all.fixedPanels!.left,all.segments[0].width,all.fixedPanels!.right]).toEqual([700,701,700]);
  expect(validatePosition(fixed)).toEqual([]);expect(validatePosition(all)).toEqual([]);
 });
 it('izjednačava polja u redu modela',()=>{
  const p=makeFieldPosition('model',undefined,'d-balcony-panel-top-sides-double');
  const modes=equalModesForPosition(p);
  expect(modes).toContain('all');
  const next={...p,...equalizePosition(p,'all')};
  const row=next.modelLayout!.rows.find(r=>r.cells.length>2)!;
  const widths=row.cells.map(c=>next.width*c.weight/weightTotal(row.cells));
  expect(Math.max(...widths)-Math.min(...widths)).toBeLessThan(.02);
 });
});
