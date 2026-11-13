import data from './porta-royal-data.json';

export const portaRoyalCatalog='https://portaroyal.rs/wp-content/uploads/2026/06/KATALOG-SOBNA-VRATA-IZMENJEN-5-compressed-1.pdf';
export const portaCatalogPath=(jobId?:string)=>jobId?`/posao/${jobId}/sobna-vrata`:'/katalog/sobna-vrata';
export const portaRoyalGroups={siena:'Siena',portofino:'Portofino',premium:'Premium','long-life':'Long Life','eko-furnir-lux':'Eko Furnir Lux',farbana:'Farbana vrata','jednodelni-stok':'Jednodelni štok'};
export const portaRoyalTypes={s:'S','s-01':'S-01','s-02':'S-02','s-03':'S-03',n:'N','n-01':'N-01','n-02':'N-02','n-03':'N-03',d:'D','d-01':'D-01','d-02':'D-02','d-03':'D-03','dn-03':'DN-03',dk:'DK',k:'K','t-02':'T-02','4l':'4L'};
export const portaFills={honeycomb:'Natron saće',chipboard:'Ekstrudirana iverica',solid:'Puno MDF krilo'};
export const portaHinges={marine:'Brodska prolazna',premium:'Premium',marineBlack:'Brodska crna',premiumBlack:'Premium crna',hidden:'Skrivene'};
export const portaLocks={standard:'Standardna',quiet:'Tiha AGB',magnetic:'Magnetna',bathroom:'Za kupatilo',cylinder:'Cilindar',hotel:'Hotelska'};
export const portaHandles={mat:'MAT',bicolor:'Bicolor',dark:'Dark','1010':'1010'};
export const portaOptions={threshold:'Padajući prag',vent:'Ventilaciona rešetka'};
export const portaGlazing={blackH:'Crni horizontalni',whiteH:'Beli horizontalni',blackV:'Crni vertikalni',whiteV:'Beli vertikalni'};

export type PortaType=keyof typeof portaRoyalTypes;
type Fill=keyof typeof portaFills;
type Hinge=keyof typeof portaHinges;
type Lock=keyof typeof portaLocks;
export type PortaSelection={series:string;decor:string;type:PortaType};
export type PortaRoyalConfig=PortaSelection&{
 direction:'left'|'right'; wall?:number; ral?:string; fill:Fill; hinge?:Hinge; lock?:Lock;
 cutout?:'O1'|'O2'|'O3'; glazing?:keyof typeof portaGlazing; handle?:keyof typeof portaHandles;
 threshold?:boolean; vent?:boolean;
};
interface PortaSeries {
 id:string;name:string;group:keyof typeof portaRoyalGroups;source:string;
 decors:readonly {id:string;name:string;image?:string}[];types:readonly PortaType[];
 variants:Readonly<Record<string,readonly [id:number,image:string]>>;
}

// The variant IDs and image paths come from the public product configurators.
export const portaRoyalSeries=data.series as unknown as readonly PortaSeries[];
export const portaSeriesById=(id:string)=>portaRoyalSeries.find(series=>series.id===id);
export const portaImage=(path:string)=>new URL(path,'https://portaroyal.rs/wp-content/uploads/').href;
export const portaTypeImage=(type:PortaType)=>portaImage(data.typeIcons[type]);
export const portaVariantCount=portaRoyalSeries.reduce((total,series)=>total+Object.keys(series.variants).length,0);
export const portaSliding=(type:PortaType)=>type==='k'||type==='dk';
export const portaLeafCount=(type:PortaType)=>type==='t-02'?3:type.startsWith('d')?2:1;
export const portaMaxDimension=20000;
export const isPortaDimension=(value:number)=>Number.isInteger(value)&&value>0&&value<=portaMaxDimension;

// Porta Royal publishes 690, 790 and 890 × 2060 mm for standard single doors.
// The other starting sizes are estimates based on the proportions of the catalog photos.
export function portaStartingSize(type:PortaType):{width:number;height:number} {
 if(type==='t-02')return {width:2390,height:2060};
 if(type==='dk')return {width:1450,height:2060};
 if(type==='dn-03')return {width:1160,height:2170};
 if(type.startsWith('d'))return {width:1330,height:2060};
 if(type.startsWith('n'))return {width:790,height:2170};
 return {width:890,height:2060};
}

interface PortaSpec {
 surface:string; hdf?:number; solid?:boolean; fills:readonly Fill[]; hinges:readonly Hinge[]; standardLock:Lock;
 cutouts?:boolean; glazing?:boolean; ral?:boolean; trim?:string; limit?:string; standardSizes?:boolean; detail?:string;
}
const basic:PortaSpec={surface:'',fills:['honeycomb','chipboard'],hinges:['marine','marineBlack','hidden'],standardLock:'standard',cutouts:true};
const solid:PortaSpec={...basic,solid:true,fills:['solid'],hinges:['premium','premiumBlack','hidden']};
const painted:PortaSpec={...basic,surface:'Izolant, PU podloga i završni PU lak',ral:true};
const eco:PortaSpec={...basic,surface:'Eko furnir od prirodnih vlakana sa nanofleks zaštitom',standardLock:'quiet',trim:'100 × 16 mm',hdf:6};
const longLife='CP2L folija sa srebrnim jonima';
const trimOnePiece='80 × 18 mm';
const specs:Record<string,PortaSpec>={
 siena:{...basic,surface:'3D melamin folija'},
 portofino:{...basic,surface:'CPL laminatna folija'},
 premium:{...solid,surface:'CPL laminatna folija',hinges:[...solid.hinges,'marine','marineBlack'],glazing:true,detail:'Šperovane frize 90 × 20 mm, obloge MDF 10 mm, ispuna MDF 14 mm'},
 'long-life-classic':{...basic,surface:longLife,hdf:6,limit:'Objavljena maksimalna visina izrade 2.170 mm'},
 'long-life-premium':{...solid,surface:longLife,glazing:true,limit:'Objavljena maksimalna visina izrade 2.170 mm',detail:'Šperovane frize 90 × 20 mm, obloge MDF 10 mm, ispuna MDF 14 mm'},
 'eko-furnir-lux-classic':eco,
 'eko-furnir-lux-premium':{...solid,surface:eco.surface,standardLock:'quiet',detail:'Šperovane frize 90 × 20 mm, obloge MDF 10 mm, ispuna MDF 14 mm'},
 'eko-furnir-lux-tablice':{...eco,hdf:8,fills:['honeycomb'],detail:'Horizontalne tablice širine 205 mm'},
 'eko-furnir-lux-premium-tablice':{...solid,surface:eco.surface,standardLock:'quiet',detail:'Horizontalne tablice širine 205 mm, šperovane frize 90 × 20 mm, ispuna MDF 14 mm'},
 'farbana-medijapan':{...painted,trim:'80 × 16 mm'},
 'farbana-medijapan-vienna':{...painted,fills:['honeycomb'],cutouts:false,limit:'Maksimalna proizvodna mera 970 × 2.170 mm',detail:'Utisnuti ukrasi na krilu'},
 'jednodelni-stok-vienna':{...painted,trim:trimOnePiece,standardSizes:true,fills:['honeycomb'],cutouts:false,detail:'Utisnuti ukrasi na krilu'},
 'jednodelni-stok-farbana-medijapan':{...painted,trim:trimOnePiece,standardSizes:true,hdf:6},
 'cpl-bela':{...basic,surface:'Bela CPL laminatna folija',trim:trimOnePiece,hdf:6},
 'cpl-bela-premium':{...solid,surface:'Bela CPL laminatna folija',trim:trimOnePiece,hinges:[...solid.hinges,'marine','marineBlack'],glazing:true,detail:'Šperovane frize 90 × 20 mm, obloge MDF 10 mm, ispuna 20 mm'},
};

export function portaTechnical(series:PortaSeries) {
 const spec=specs[series.id];
 const single=series.group==='jednodelni-stok';
 return {...spec,frame:single?'Jednodelni štelujući štok, puna kutija 40 mm':'Štelujući štok',
  wall:single?'90–290 mm':'70–300+ mm',
  leaf:spec.solid?'Puno krilo sa MDF ispunom':`MDF ram ojačan ivericom, obostrana HDF obloga${spec.hdf?` ${spec.hdf} mm`:''}`};
}

export function portaVariant(selection:PortaSelection){
 const series=portaSeriesById(selection.series);
 const decor=series?.decors.find(item=>item.id===selection.decor);
 const variant=series?.variants[`${selection.decor}/${selection.type}`];
 return series&&decor&&variant?{series,decor,code:portaRoyalTypes[selection.type],id:variant[0],image:variant[1]}:undefined;
}

export function portaDefaultSelection(series:PortaSeries):PortaSelection {
 const decor=series.decors[0].id;
 const type=series.types.find(type=>series.variants[`${decor}/${type}`])!;
 return {series:series.id,decor,type};
}

export function portaConfiguration(selection:PortaSelection):PortaRoyalConfig {
 const {series}=portaVariant(selection)!;
 const spec=portaTechnical(series);
 const sliding=portaSliding(selection.type);
 return {...selection,direction:'left',fill:spec.fills[0],hinge:sliding?undefined:spec.hinges[0],lock:sliding?undefined:spec.standardLock};
}

export function portaVariantSource(selection:PortaSelection) {
 const variant=portaVariant(selection);
 return variant&&`${variant.series.source}?${new URLSearchParams({'attribute_pa_dostupni-dekori':selection.decor,'attribute_pa_tip':selection.type})}`;
}

export function portaDecorName(config:PortaRoyalConfig) {
 return config.ral?.trim()?`RAL ${config.ral.trim().replace(/^RAL\s*/i,'')}`:portaVariant(config)?.decor.name??'';
}

export function portaPositionName(config:PortaRoyalConfig) {
 const variant=portaVariant(config)!;
 return `Porta Royal ${variant.series.name} · ${portaDecorName(config)} · ${variant.code}`;
}

export function portaDirection(config:PortaRoyalConfig) {
 if(config.type==='dk')return 'Klizna na obe strane';
 if(config.type==='k')return config.direction==='left'?'Klizanje ulevo':'Klizanje udesno';
 return config.direction==='left'?'Šarke levo':'Šarke desno';
}

export function isPortaRoyalConfig(value:unknown):value is PortaRoyalConfig {
 if(!value||typeof value!=='object')return false;
 const config=value as PortaRoyalConfig;
 if(typeof config.series!=='string'||typeof config.decor!=='string'||typeof config.type!=='string')return false;
 const variant=portaVariant(config);
 if(!variant)return false;
 const spec=portaTechnical(variant.series);
 const sliding=portaSliding(config.type);
 return ['left','right'].includes(config.direction)&&spec.fills.includes(config.fill)
  &&(config.wall===undefined||Number.isFinite(config.wall)&&config.wall>=0&&config.wall<=2000)
  &&(config.ral===undefined||!!spec.ral&&typeof config.ral==='string'&&config.ral.length<=24)
  &&(config.hinge===undefined||!sliding&&spec.hinges.includes(config.hinge))
  &&(config.lock===undefined||!sliding&&Object.hasOwn(portaLocks,config.lock))
  &&(config.cutout===undefined||!!spec.cutouts&&['O1','O2','O3'].includes(config.cutout))
  &&(config.glazing===undefined||!!spec.glazing&&Object.hasOwn(portaGlazing,config.glazing))
  &&(config.handle===undefined||!sliding&&Object.hasOwn(portaHandles,config.handle))
  &&(config.threshold===undefined||typeof config.threshold==='boolean')&&(config.vent===undefined||typeof config.vent==='boolean');
}
