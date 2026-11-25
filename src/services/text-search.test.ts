import { describe, expect, it } from 'vitest';
import { matchesTextSearch } from './text-search';

describe('Pretraga cenovnika',()=>{
 it('nalazi sve reči nezavisno od redosleda, velikih slova i dijakritike',()=>{
  expect(matchesTextSearch('70 pvc RAM','Profili','PVC ram 70 mm')).toBe(true);
  expect(matchesTextSearch('vozice','Višekanalne vođice')).toBe(false);
  expect(matchesTextSearch('VODJICE','Višekanalne vođice')).toBe(true);
  expect(matchesTextSearch('sklopivi okov','Okovi','Doplata za sklopivi okov')).toBe(true);
  expect(matchesTextSearch('   ','Profili')).toBe(true);
 });
 it('zahteva da postoje sve zadate reči',()=>{
  expect(matchesTextSearch('motor komarnik','Dodaci','Motor za komarnik')).toBe(true);
  expect(matchesTextSearch('motor komarnik','Posebni sistemi','Motorni pogon')).toBe(false);
 });
});
