import { describe, expect, it } from 'vitest';
import { makePosition } from './catalog';
import { changeShutter, changeShutterMotor, changeShutterType, isShutterConfig, makeShutter, shutterEquipmentLabel, type ShutterConfig } from './shutters';
import { parseStoredPosition } from './services/storage';

describe('Pogon i kutija roletne',()=>{
 it('čuva izbor motora, daljinskog i materijala kroz promenu tipa i učitavanje',()=>{
  const original:ShutterConfig={...makeShutter('facade','window'),cordSide:'right',boxMaterial:'ALU',motor:true,remote:true,width:1700};
  const next=changeShutterType(original,'top');
  expect(next).toMatchObject({type:'top',mount:'inside',boxHeight:200,part:'window',cordSide:'right',boxMaterial:'ALU',motor:true,remote:true});
  expect(next.width).toBeUndefined();expect(isShutterConfig(next)).toBe(true);
  const p=makePosition(),saved={...p,...changeShutter(p,next)};
  expect(parseStoredPosition(JSON.parse(JSON.stringify(saved))).shutterConfig).toEqual(next);
 });
 it('uklanja daljinski kada se isključi motor, a pamti prethodnu stranu kanapa',()=>{
  const motor:ShutterConfig={...makeShutter(),motor:true,remote:true,cordSide:'left',boxMaterial:'PVC'};
  const manual=changeShutterMotor(motor,false);
  expect(manual).toMatchObject({motor:false,cordSide:'left',boxMaterial:'PVC'});
  expect(manual.remote).toBeUndefined();expect(isShutterConfig(manual)).toBe(true);
  expect(changeShutterMotor(manual,true).remote).toBeUndefined();
 });
 it('prihvata stare roletne bez novih opcija i odbija nevažeće ili protivrečne izbore',()=>{
  expect(isShutterConfig(makeShutter())).toBe(true);
  for(const invalid of [{cordSide:'middle'},{boxMaterial:'wood'},{motor:'true'},{motor:false,remote:true},{remote:false},{motor:true,remote:'yes'}])expect(isShutterConfig({...makeShutter(),...invalid})).toBe(false);
 });
 it('u dokumentima razlikuje kanap, motor i daljinski bez pretpostavki za stare poslove',()=>{
  expect(shutterEquipmentLabel(makeShutter())).toBe('');
  expect(shutterEquipmentLabel({...makeShutter(),motor:false,cordSide:'right',boxMaterial:'PVC'})).toBe('Kutija: PVC · Bez motora (kanap) · Kanap desno (pogled iznutra)');
  const motor={...makeShutter(),motor:true,cordSide:'left' as const,boxMaterial:'ALU' as const};
  expect(shutterEquipmentLabel({...motor,remote:true})).toBe('Kutija: ALU · Sa motorom · Sa daljinskim upravljačem');
  expect(shutterEquipmentLabel({...motor,remote:false})).toContain('Bez daljinskog upravljača');
  expect(shutterEquipmentLabel(motor)).toContain('nije navedeno');
 });
});
