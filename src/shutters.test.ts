import { describe, expect, it } from 'vitest';
import { makePosition } from './catalog';
import { changeShutter, changeShutterMotor, changeShutterDrive, changeShutterType, isShutterConfig, makeShutter, shutterEquipmentLabel, shutterBoxShapes, shutterBoxShapeLabels, type ShutterConfig } from './shutters';
import { parseStoredPosition } from './services/storage';

describe('Pogon i kutija roletne',()=>{
 it('čuva izbor motora, daljinskog i materijala kroz promenu tipa i učitavanje',()=>{
  const original:ShutterConfig={...makeShutter('facade','window'),cordSide:'right',motorSide:'left',boxMaterial:'ALU',motor:true,remote:true,guide:'withExtension',width:1700};
  const next=changeShutterType(original,'top');
  expect(next).toMatchObject({type:'top',mount:'inside',boxHeight:200,part:'window',cordSide:'right',motorSide:'left',boxMaterial:'ALU',motor:true,remote:true,guide:'withExtension'});
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
  for(const invalid of [{cordSide:'middle'},{boxMaterial:'wood'},{motor:'true'},{motor:false,remote:true},{remote:false},{motor:true,remote:'yes'},{guide:'unknown'},{shape:'unknown'},{manualControl:'invalid'},{motorSide:'middle'}])expect(isShutterConfig({...makeShutter(),...invalid})).toBe(false);
 });
 it('u dokumentima razlikuje kanap, motor i daljinski bez pretpostavki za stare poslove',()=>{
  expect(shutterEquipmentLabel(makeShutter())).toBe('');
  expect(shutterEquipmentLabel({...makeShutter(),motor:false,cordSide:'right',boxMaterial:'PVC'})).toBe('Kutija: PVC · Bez motora (kanap) · Kanap desno (pogled iznutra)');
  const motor={...makeShutter(),motor:true,cordSide:'left' as const,boxMaterial:'ALU' as const};
  expect(shutterEquipmentLabel({...motor,remote:true})).toBe('Kutija: ALU · Sa motorom · Sa daljinskim upravljačem');
  expect(shutterEquipmentLabel({...motor,remote:false})).toContain('Bez daljinskog upravljača');
  expect(shutterEquipmentLabel(motor)).toContain('nije navedeno');
  expect(shutterEquipmentLabel({...motor,motorSide:'right'})).toContain('Motor desno (pogled iznutra)');
 });
 it('čuva obe vodilice i nove oblike kutije, uz čitljiv raniji izbor Poluobla',()=>{
  expect(Object.values(shutterBoxShapes)).toContain('Poluobla rondo');
  expect(Object.values(shutterBoxShapes)).toContain('Poluobla eko');
  expect(Object.values(shutterBoxShapes)).not.toContain('Poluobla');
  for(const guide of ['flat','withExtension'] as const)for(const shape of ['halfRoundRondo','halfRoundEko'] as const){
   const config={...makeShutter(),guide,shape};
   const p=makePosition(),stored=parseStoredPosition(JSON.parse(JSON.stringify({...p,...changeShutter(p,config)})));
   expect(stored.shutterConfig).toEqual(config);
   expect(shutterEquipmentLabel(config)).toContain(guide==='flat'?'Ravna vodilica':'Vodilica sa dodatkom');
  }
  expect(isShutterConfig({...makeShutter(),shape:'halfRound'})).toBe(true);
  expect(shutterBoxShapeLabels.halfRound).toBe('Poluobla (ranije sačuvano)');
 });

 it('traka ima svoju stranu i čuva se kroz promenu tipa, motora i rezervnu kopiju',()=>{
  const strap={...changeShutterDrive({...makeShutter(),motor:true,remote:true},'strap'),cordSide:'right' as const};
  expect(strap).toMatchObject({motor:false,manualControl:'strap',cordSide:'right'});
  expect(strap.remote).toBeUndefined();
  expect(shutterEquipmentLabel(strap)).toBe('Bez motora (traka) · Traka desno (pogled iznutra)');
  expect(changeShutterType(strap,'top').manualControl).toBe('strap');
  const p=makePosition();
  expect(parseStoredPosition(JSON.parse(JSON.stringify({...p,...changeShutter(p,strap)}))).shutterConfig).toEqual(strap);
  const motor=changeShutterDrive(strap,'motor');expect(motor.manualControl).toBe('strap');
  expect(shutterEquipmentLabel(motor)).not.toContain('Traka');
  expect(changeShutterDrive(motor,'cord').manualControl).toBe('cord');
  expect(changeShutterDrive(motor,undefined).manualControl).toBeUndefined();
 });

});
