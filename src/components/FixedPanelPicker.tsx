import { useState } from 'react';
import { centralWidth, noPanels, panelLabels, type FixedPanels, type PanelSide } from '../fixed-panels';
import type { Position } from '../models';
import { validatePosition } from '../services/calculation';
import { Drawing } from './Drawing';
import { Modal } from './UI';

export function FixedPanelPicker({position,isDoor,onApply,onClose}:{
 position:Position; isDoor:boolean; onApply:(next:Position)=>void; onClose:()=>void;
}) {
 const [panels,setPanels]=useState(position.fixedPanels??noPanels);
 const [fixedMiddle,setFixedMiddle]=useState(false);
 const sides:PanelSide[]=isDoor?['top','left','right']:['top','bottom','left','right'];
 const width=centralWidth(position.width,panels);
 const oldWidth=position.segments.reduce((sum,segment)=>sum+segment.width,0);
 const segments=fixedMiddle
  ? [{width:width/3,opening:'Levo'},{width:width/3,opening:'Fiksno'},{width:width/3,opening:'Desno'}] as const
  : position.segments.map(segment=>({...segment,width:oldWidth>0?segment.width*width/oldWidth:width/position.segments.length}));
 const next={...position,fixedPanels:sides.some(side=>panels[side]!==0)?panels:undefined,segments:[...segments]};
 const error=sides.some(side=>Number.isNaN(panels[side]))?'Unesite meru fiksnog polja.':validatePosition(next)[0];
 const setPanel=(side:PanelSide,value:number)=>setPanels(previous=>({...previous,[side]:value}));

 return <Modal title="Raspored fiksnih polja" onClose={onClose}>
  <div className="fixed-panel-picker">
   <p>Kombinujte polja i unesite njihove mere. Širina i visina elementa su spoljne mere.</p>
   {!error&&<div className="fixed-panel-preview"><Drawing position={next}/></div>}
   <div className="fixed-panel-options">
    {sides.map(side=><div key={side}>
     <label><input type="checkbox" checked={panels[side]!==0} onChange={event=>setPanel(side,event.target.checked?Math.max(100,Math.round((side==='top'||side==='bottom'?position.height:position.width)/5)):0)}/>{panelLabels[side]}</label>
     {panels[side]!==0&&<input type="number" min={100} step={1} inputMode="numeric" aria-label={`${panelLabels[side]} (mm)`} value={Number.isNaN(panels[side])?'':panels[side]} onChange={event=>setPanel(side,event.target.value===''?NaN:Math.max(1,event.target.valueAsNumber))}/>}
    </div>)}
   </div>
   {!isDoor&&<label className="fixed-panel-middle"><input type="checkbox" checked={fixedMiddle} onChange={event=>setFixedMiddle(event.target.checked)}/>Postavi dva krila sa fiksnim poljem u sredini</label>}
   {error&&<p className="field-error" role="alert">{error}</p>}
   <button type="button" className="field-button field-button-yellow" disabled={!!error} onClick={()=>onApply(next)}>Primeni raspored</button>
  </div>
 </Modal>;
}
