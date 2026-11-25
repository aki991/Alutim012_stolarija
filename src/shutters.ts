import type { Position } from './models';

export const shutterTypes={
 top:{label:'Nadgradna (nasadna)',mount:'inside',boxHeight:200,rate:'shutterTop'},
 reveal:{label:'Spoljna na ramu / u špaletni',mount:'overlay',boxHeight:165,rate:'shutterReveal'},
 facade:{label:'Spoljna na fasadi',mount:'above',boxHeight:165,rate:'shutterFacade'},
 flush:{label:'Podfasadna',mount:'above',boxHeight:180,rate:'shutterFlush'},
 lintel:{label:'Ugradna u nadvoj',mount:'above',boxHeight:200,rate:'shutterLintel'},
} as const;
export const shutterMounts={
 inside:'Kutija u visini otvora',
 overlay:'Kutija ispred rama',
 above:'Kutija iznad otvora',
} as const;
export const shutterBoxShapes={square:'Pravougaona',bevel:'Zakošena 45°',round:'Obla',halfRoundRondo:'Poluobla rondo',halfRoundEko:'Poluobla eko'} as const;
export const shutterBoxShapeLabels={...shutterBoxShapes,halfRound:'Poluobla (ranije sačuvano)'} as const;
export const shutterGuides={withExtension:'Vodilica sa dodatkom',flat:'Ravna vodilica'} as const;
export type ShutterType=keyof typeof shutterTypes;
export type ShutterRate=typeof shutterTypes[ShutterType]['rate'];
export type ShutterPart='door'|'window';
export interface ShutterConfig {
 type:ShutterType;
 boxHeight:number;
 mount:keyof typeof shutterMounts;
 part?:ShutterPart;
 width?:number;
 shape?:keyof typeof shutterBoxShapeLabels;
 guide?:keyof typeof shutterGuides;
 cordSide?:'left'|'right';
 motorSide?:'left'|'right';
 manualControl?:'cord'|'strap';
 motor?:boolean;
 remote?:boolean;
 boxMaterial?:'PVC'|'ALU';
}

export const shutterMaxBox=2000;
export const shutterMaxWidth=20000;
export const supportsShutter=(p:Position)=>['Prozori','Vrata','Ulazna vrata','Klizni sistemi'].includes(p.category);

export function makeShutter(type:ShutterType='reveal',part?:ShutterPart):ShutterConfig {
 const {mount,boxHeight}=shutterTypes[type];
 return {type,mount,boxHeight,part,shape:type==='reveal'||type==='facade'?'bevel':undefined};
}

export function changeShutterType(config:ShutterConfig,type:ShutterType):ShutterConfig {
 return {...makeShutter(type,config.part),cordSide:config.cordSide,motorSide:config.motorSide,manualControl:config.manualControl,motor:config.motor,
  remote:config.motor?config.remote:undefined,boxMaterial:config.boxMaterial,guide:config.guide};
}

export function changeShutterMotor(config:ShutterConfig,motor?:boolean):ShutterConfig {
 return {...config,motor,remote:motor?config.remote:undefined};
}

export function changeShutterDrive(config:ShutterConfig,drive:'cord'|'strap'|'motor'|undefined):ShutterConfig {
 return {...changeShutterMotor(config,drive===undefined?undefined:drive==='motor'),
  manualControl:drive==='motor'?config.manualControl:drive};
}

export function shutterEquipmentLabel(config:ShutterConfig):string {
 return [config.boxMaterial&&`Kutija: ${config.boxMaterial}`,
  config.guide&&shutterGuides[config.guide],
  config.motor===true?'Sa motorom':config.motor===false?`Bez motora (${config.manualControl==='strap'?'traka':'kanap'})`:'',
  config.motor===true&&config.motorSide?`Motor ${config.motorSide==='left'?'levo':'desno'} (pogled iznutra)`:'',
  config.motor===true?(config.remote===true?'Sa daljinskim upravljačem':config.remote===false?'Bez daljinskog upravljača':'Daljinski upravljač: nije navedeno')
   :config.cordSide?`${config.manualControl==='strap'?'Traka':'Kanap'} ${config.cordSide==='left'?'levo':'desno'} (pogled iznutra)`:'',
 ].filter(Boolean).join(' · ');
}

export function shutterOf(p:Position):ShutterConfig|undefined {
 return p.shutter||p.category==='Roletne'?p.shutterConfig??makeShutter():undefined;
}

export function isShutterConfig(value:unknown):value is ShutterConfig {
 const config=value as ShutterConfig|undefined;
 return !!config&&typeof config.type==='string'&&Object.hasOwn(shutterTypes,config.type)
  &&typeof config.mount==='string'&&Object.hasOwn(shutterMounts,config.mount)
  &&(config.type==='flush'||config.mount===shutterTypes[config.type].mount)
  &&Number.isFinite(config.boxHeight)&&config.boxHeight>=1&&config.boxHeight<=shutterMaxBox
  &&(config.part===undefined||config.part==='door'||config.part==='window')
  &&(config.width===undefined||config.mount==='above'&&Number.isFinite(config.width)&&config.width>=1&&config.width<=shutterMaxWidth)
  &&(config.shape===undefined||typeof config.shape==='string'&&Object.hasOwn(shutterBoxShapeLabels,config.shape))
  &&(config.guide===undefined||typeof config.guide==='string'&&Object.hasOwn(shutterGuides,config.guide))
  &&(config.cordSide===undefined||config.cordSide==='left'||config.cordSide==='right')
  &&(config.motorSide===undefined||config.motorSide==='left'||config.motorSide==='right')
  &&(config.manualControl===undefined||config.manualControl==='cord'||config.manualControl==='strap')
  &&(config.motor===undefined||typeof config.motor==='boolean')
  &&(config.remote===undefined||typeof config.remote==='boolean'&&config.motor===true)
  &&(config.boxMaterial===undefined||config.boxMaterial==='PVC'||config.boxMaterial==='ALU');
}

export function shutterPart(p:Position,config:ShutterConfig):ShutterPart {
 return p.combination?config.part??'window':'door';
}

export function openingBoxHeight(p:Position,part:ShutterPart='door') {
 const config=shutterOf(p);
 return p.category!=='Roletne'&&p.shutter&&config?.mount==='inside'&&shutterPart(p,config)===part?config.boxHeight:0;
}

export function shutterMeasures(p:Position,config:ShutterConfig) {
 const part=shutterPart(p,config);
 const frameHeight=part==='window'?p.combination!.windowHeight:p.height;
 const frameWidth=p.combination?p.segments[part==='window'?1:0].width:p.width;
 const width=p.category==='Roletne'?p.width:config.width??frameWidth;
 const totalHeight= p.category==='Roletne'||config.mount==='overlay'?frameHeight:frameHeight+config.boxHeight;
 return {part,width,totalHeight,frameHeight,openingHeight:frameHeight+openingBoxHeight(p,part)};
}

export function changeShutter(p:Position,config?:ShutterConfig):Partial<Position> {
 if(p.category==='Roletne')return {shutterConfig:config};
 const next={...p,shutter:!!config,shutterConfig:config};
 const patch:Partial<Position>={shutter:next.shutter,shutterConfig:next.shutterConfig};
 // A measured opening stays fixed when a box is added, moved or removed.
 // A drawn contour already describes the physical frame.
 if(!p.customGeometry){
  const difference=(part:ShutterPart)=>openingBoxHeight(p,part)-openingBoxHeight(next,part);
  patch.height=p.height+difference('door');
  if(p.combination)patch.combination={...p.combination,windowHeight:p.combination.windowHeight+difference('window')};
 }
 return patch;
}
