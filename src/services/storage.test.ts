import { describe, expect, it } from 'vitest';
import { parseBackup } from './storage';
import { defaults } from './calculation';
import { makePosition } from '../catalog';
const backup=()=>({settings:structuredClone(defaults),jobs:[{id:'AT-TEST',customer:{name:'Đorđe Živković',phone:'064',email:'',address:'Pančevo',building:'Stan'},date:'2026-11-01',technician:'Aleksandar',notes:'',status:'U izradi',positions:[makePosition()],package:'Standard',discount:0,transport:35,extraWork:'',extraCost:0,validity:'15 dana',delivery:'Dogovor',payment:'Avans',updated:''}]});
describe('Lokalne rezervne kopije',()=>{
 it('prihvata celu rezervnu kopiju sa srpskim slovima',()=>{expect(parseBackup(backup()).jobs[0].customer.name).toBe('Đorđe Živković');});
 it('učitava posao iz korpe sa elementima i odbija isti ID u oba spiska',()=>{
  const original=backup(),job=original.jobs[0],trash=[{job,deletedAt:'2026-11-16T13:00:00.000Z'}];
  expect(parseBackup({...original,jobs:[],trash}).trash[0]).toMatchObject(trash[0]);
  expect(()=>parseBackup({...original,trash})).toThrow();
 });
 it('odbija oštećene podatke umesto rušenja aplikacije',()=>{const b=backup();delete (b.settings.prices as Partial<typeof defaults.prices>).PVC;expect(()=>parseBackup(b)).toThrow();expect(()=>parseBackup(null)).toThrow();});
 it('odbija duplirane identifikatore i nepoznate tipove otvaranja',()=>{const b=backup();b.jobs.push(structuredClone(b.jobs[0]));expect(()=>parseBackup(b)).toThrow();const c=backup();(c.jobs[0].positions[0].segments[0] as {opening:string}).opening='unknown';expect(()=>parseBackup(c)).toThrow();});
 it('čuva neispravne mere kao nacrt, a odbija nepodržane fotografije',()=>{const b=backup();b.jobs[0].positions[0].width=-200;b.jobs[0].positions[0].segments[0].width=-100;expect(()=>parseBackup(b)).not.toThrow();b.jobs[0].positions[0].photos=['https://example.com/tracker'];expect(()=>parseBackup(b)).toThrow();});
 it('migrira stari posao bez izmene ID-ja, mera, cena, fotografija i popusta',()=>{const b=backup();delete b.jobs[0].positions[0].profile;b.jobs[0].discount=7;b.jobs[0].positions[0].photos=['/assets/house.jpg'];const original=structuredClone(b);const migrated=parseBackup(b);expect(migrated.jobs[0].id).toBe(original.jobs[0].id);expect(migrated.jobs[0].positions[0].profile).toBe('PVC 70 mm');expect(migrated.jobs[0].createdAt).toBe('2026-11-01T12:00:00');expect(migrated.jobs[0].positions[0].photos).toEqual(original.jobs[0].positions[0].photos);expect(migrated.jobs[0].positions[0].width).toBe(original.jobs[0].positions[0].width);expect(migrated.jobs[0].discount).toBe(7);expect(migrated.settings).toEqual(original.settings);expect(b).toEqual(original);});
 it('čuva nove podrazumevane opcije, bez promene postojećih pozicija',()=>{const b=backup();const settings={...b.settings,elementDefaults:{material:'ALU' as const,profile:'ALU termo profil',color:'Antracit',glass:'Troslojno' as const,hardware:'Sigurnosni' as const},documentDefaults:{validity:'30 dana',delivery:'Po dogovoru',payment:'Avans'}};const result=parseBackup({...b,settings});expect(result.settings).toEqual(settings);expect(result.jobs[0].positions[0].material).toBe('PVC');expect(result.jobs[0].validity).toBe('15 dana');});
 it('odbija oštećene nove opcije iz rezervne kopije',()=>{const b=backup();expect(()=>parseBackup({...b,settings:{...b.settings,elementDefaults:{material:'nepoznat'}}})).toThrow();expect(()=>parseBackup({...b,settings:{...b.settings,documentDefaults:{validity:12}}})).toThrow();});
 it('čuva datume evidencije i odbija nemoguće datume',()=>{
  const b=backup();const job={...b.jobs[0],status:'Ugrađeno',completionDeadline:'2026-12-20',measuredOn:'2026-11-25',completedOn:'2026-12-01',installedOn:'2026-12-02'};
  expect(parseBackup({...b,jobs:[job]}).jobs[0]).toMatchObject(job);
  for(const key of ['completionDeadline','measuredOn','completedOn','installedOn'])expect(()=>parseBackup({...b,jobs:[{...job,[key]:'2026-02-30'}]})).toThrow();
 });

});
