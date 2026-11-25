import { describe, expect, it } from 'vitest';
import { canChangeAssignment } from './job-assignment';

describe('Vlasnik zahteva za merenje',()=>{
 const sender={id:'sender',role:'manager' as const},other={id:'other',role:'manager' as const},worker={id:'milos',role:'worker' as const};
 it('ni drugi šef ni primalac ne mogu da promene postojeću dodelu',()=>{
  const origin={created_by:'other',assigned_by:'sender'};
  expect(canChangeAssignment(sender,origin)).toBe(true);
  expect(canChangeAssignment(other,origin)).toBe(false);
  expect(canChangeAssignment(worker,origin)).toBe(false);
 });
 it('poštuje dozvolu baze i kada su privatni podaci o pošiljaocu sakriveni',()=>{
  expect(canChangeAssignment(other,{assigned_by:null,created_by:'other',can_reassign:false})).toBe(false);
  expect(canChangeAssignment(sender,{assigned_by:null,created_by:'other',can_reassign:true})).toBe(true);
  expect(canChangeAssignment(worker,{assigned_by:null,can_reassign:true})).toBe(false);
 });
 it('nepoznata dodela ne otključava preuzimanje; tvorac može da dodeli svoj nov posao',()=>{
  expect(canChangeAssignment(sender)).toBe(false);
  expect(canChangeAssignment(sender,{assigned_by:null})).toBe(false);
  expect(canChangeAssignment(sender,{created_by:'sender',assigned_by:null})).toBe(true);
 });
});
