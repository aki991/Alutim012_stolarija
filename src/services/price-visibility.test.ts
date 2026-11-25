import { describe, expect, it } from 'vitest';
import { teamPriceVisibility } from './price-visibility';

describe('Prikaz cena u timu',()=>{
 it('šef određuje da li majstor može da vidi cene bez obzira na lični izbor',()=>{
  for(const personal of [true,false,undefined])expect(teamPriceVisibility('worker',personal,true,false)).toBe(false);
  expect(teamPriceVisibility('worker',true,true,true)).toBe(true);
  expect(teamPriceVisibility('worker',undefined,true,true)).toBe(true);
  expect(teamPriceVisibility('worker',false,true,true)).toBe(false);
 });
 it('zabrana za majstore ne menja prikaz šefu',()=>{
  expect(teamPriceVisibility('manager',true,true,false)).toBe(true);
  expect(teamPriceVisibility('manager',false,true,true)).toBe(false);
 });
 it('ne prikazuje cene dok se ne učitaju podešavanja tima',()=>{
  expect(teamPriceVisibility('worker',true,false,true)).toBe(false);
  expect(teamPriceVisibility('worker',true,true,null)).toBe(false);
  expect(teamPriceVisibility('manager',true,true,null)).toBe(true);
  expect(teamPriceVisibility('manager',true,false,null)).toBe(false);
 });
});
