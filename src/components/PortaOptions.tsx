import { useState } from 'react';
import { PortaDoorArt } from './PortaDrawing';
import { Field } from './UI';
import { portaConfiguration, portaFills, portaHinges, portaImage, portaRoyalCatalog, portaRoyalTypes, portaStartingSize, portaTechnical, portaTypeImage, portaVariant, portaVariantSource, type PortaSelection } from '../porta-royal';
import photoCrops from '../porta-royal-photo-crops.json';

// Crop coordinates are measured on a normalized copy of the supplier's image.
const photoWidth=1100,photoHeight=792;
const crops:Record<string,number[]>=photoCrops;

export function PortaPhoto({selection,lazy=false,size,dimensions=false}:{selection:PortaSelection;lazy?:boolean;size?:{width:number;height:number};dimensions?:boolean}) {
 const {id,series,code,decor,image}=portaVariant(selection)!;
 const src=portaImage(image),[failed,setFailed]=useState('');
 const crop=crops[id];
 const [left,top,right,bottom,...outline]=crop??[0,0,photoWidth,photoHeight];
 const cropWidth=right-left,cropHeight=bottom-top;
 const initial=portaStartingSize(selection.type);
 const width=size&&size.width>0?size.width:initial.width;
 const height=size&&size.height>0?size.height:initial.height;
 const showPhoto=!!crop&&failed!==src;
 // At the starting size the photo keeps its original proportions, including the rail on sliding doors.
 const referenceWidth=showPhoto?initial.height*cropWidth/cropHeight:initial.width;
 const displayWidth=width/initial.width*referenceWidth;
 const aspect=displayWidth/height;
 const scale=`min(var(--porta-photo-scale), calc(87cqw / ${referenceWidth}), calc(var(--porta-photo-max-height) * .86 / ${initial.height}))`;
 const polygon=showPhoto&&outline.length?Array.from({length:outline.length/2},(_,i)=>{
  const x=(outline[2*i]-left)/cropWidth*100,y=(outline[2*i+1]-top)/cropHeight*100;
  return `${x}% ${y}%`;
 }).join(', '):undefined;
 const widthLabel=size&&size.width<=0?'—':`${width} mm`;
 const heightLabel=size&&size.height<=0?'—':`${height} mm`;
 return <div className={dimensions?'porta-photo porta-photo-dimensioned':'porta-photo'}>
  <div className="porta-photo-frame" style={{width:`min(100%, calc(${scale} * ${displayWidth}), calc(var(--porta-photo-max-height) * ${aspect}))`,aspectRatio:aspect}}>
   {dimensions&&<>
    <div className="porta-photo-dimension porta-photo-dimension-width" role="group" aria-label="Širina vrata"><span>{widthLabel}</span><i aria-hidden="true"/></div>
    <div className="porta-photo-dimension porta-photo-dimension-height" role="group" aria-label="Visina vrata"><span>{heightLabel}</span><i aria-hidden="true"/></div>
   </>}
   <div className="porta-photo-door" style={{clipPath:polygon?`polygon(${polygon})`:undefined}}>
    {showPhoto?<img key={src} src={src} loading={lazy?'lazy':'eager'} referrerPolicy="no-referrer" onError={()=>setFailed(src)} alt={`${series.name} · ${decor.name} · ${code}`}
     style={{left:`${-left/cropWidth*100}%`,top:`${-top/cropHeight*100}%`,width:`${photoWidth/cropWidth*100}%`,height:`${photoHeight/cropHeight*100}%`}}/>:
     <svg viewBox="0 0 106 182" preserveAspectRatio="none" aria-label={`Skica tipa ${code}`} role="img"><PortaDoorArt config={portaConfiguration(selection)} x={9} y={9} width={88} height={172}/></svg>}
   </div>
  </div>
 </div>;
}

export function PortaVariantOptions({selection,onChange}:{selection:PortaSelection;onChange:(next:PortaSelection)=>void}) {
 const {series}=portaVariant(selection)!;
 return <div className="porta-variants">
  <Field label="Dekor"><select value={selection.decor} onChange={event=>{
   const decor=event.target.value;
   const type=series.variants[`${decor}/${selection.type}`]?selection.type:series.types.find(type=>series.variants[`${decor}/${type}`])!;
   onChange({...selection,decor,type});
  }}>{series.decors.map(decor=><option key={decor.id} value={decor.id}>{decor.name}</option>)}</select></Field>
  <div className="porta-swatches" role="group" aria-label="Uzorki dekora">{series.decors.map(decor=><button key={decor.id} type="button" aria-label={`Dekor ${decor.name}`} aria-pressed={selection.decor===decor.id} onClick={()=>{
   const type=series.variants[`${decor.id}/${selection.type}`]?selection.type:series.types.find(type=>series.variants[`${decor.id}/${type}`])!;
   onChange({...selection,decor:decor.id,type});
  }}>
   {decor.image&&<img src={portaImage(decor.image)} alt="" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.hidden=true;}}/>}<span>{decor.name}</span>
  </button>)}</div>
  <Field label="Tip vrata"><select value={selection.type} onChange={event=>onChange({...selection,type:event.target.value as PortaSelection['type']})}>
   {series.types.filter(type=>series.variants[`${selection.decor}/${type}`]).map(type=><option key={type} value={type}>{portaRoyalTypes[type]}</option>)}
  </select></Field>
  <div className="porta-types" role="group" aria-label="Skice tipova vrata">{series.types.filter(type=>series.variants[`${selection.decor}/${type}`]).map(type=><button key={type} type="button" aria-label={`Tip ${portaRoyalTypes[type]}`} aria-pressed={selection.type===type} onClick={()=>onChange({...selection,type})}>
   <img src={portaTypeImage(type)} referrerPolicy="no-referrer" alt="" onError={event=>{event.currentTarget.hidden=true;}}/><span>{portaRoyalTypes[type]}</span>
  </button>)}</div>
 </div>;
}

export function PortaTechnicalDetails({selection}:{selection:PortaSelection}) {
 const {series}=portaVariant(selection)!;
 const spec=portaTechnical(series);
 const fields=[['Krilo',spec.leaf],['Završna obrada',spec.surface],['Štok',spec.frame],['Debljina zida',spec.wall],['Ispuna',spec.fills.map(fill=>portaFills[fill]).join(' / ')],['Šarke',portaHinges[spec.hinges[0]]],['Pervajz',spec.trim],['Konstrukcija',spec.detail],['Mere proizvođača',[spec.standardSizes?'690, 790 ili 890 × 2.060 mm, dostupna izrada po meri':'',spec.limit].filter(Boolean).join(' · ')]];
 return <details className="porta-technical"><summary>Tehničke karakteristike</summary>
  <dl>{fields.filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  <div className="porta-technical-links">
   <a href={portaVariantSource(selection)} target="_blank" rel="noreferrer">Otvori izabranu varijantu na Porta Royal sajtu</a>
   <a href={portaRoyalCatalog} target="_blank" rel="noreferrer">Katalog proizvođača</a>
  </div>
 </details>;
}
