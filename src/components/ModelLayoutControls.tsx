import { Plus, Trash2 } from 'lucide-react';
import { infills, maxModelCells, maxModelRows, movements, resizeBand, weightTotal, type Infill, type ModelCell, type ModelLayout, type Movement } from '../model-layout';
import { NumberInput } from './NumberInput';
import { Field } from './UI';

const dimension=(weight:number,total:number,size:number)=>Math.round(weight/total*size*100)/100;

export function ModelLayoutControls({layout,width,height,onChange}:{layout:ModelLayout;width:number;height:number;onChange:(layout:ModelLayout)=>void}) {
 const corner=layout.cornerAfter;
 const updateCells=(rowIndex:number,cells:ModelCell[])=>onChange({...layout,rows:layout.rows.map((row,index)=>index===rowIndex?{...row,cells}:row)});
 const rowsTotal=weightTotal(layout.rows);
 return <section className="model-layout-controls" aria-label="Podešavanje modela">
  <h2>{layout.system}</h2>
  {corner&&<p>Razvijeni pogled ugla. Ukupna širina je zbir dužina oba kraka.</p>}
  <details className="model-layout-details">
   <summary>Otvaranje, raspored i mere polja</summary>
   {layout.rows.map((row,rowIndex)=>{
    const cellsTotal=weightTotal(row.cells);
    const updateCell=(cellIndex:number,patch:Partial<ModelCell>)=>updateCells(rowIndex,row.cells.map((cell,index)=>index===cellIndex?{...cell,...patch}:cell));
    return <fieldset className="model-layout-row" key={rowIndex}>
     <legend>{`Red ${rowIndex+1}`}</legend>
     <div className="model-layout-row-actions">
      <Field label={`Visina reda ${rowIndex+1} (mm)`}><NumberInput min={1} step="0.01" inputMode="decimal" disabled={layout.rows.length===1} value={dimension(row.weight,rowsTotal,height)} onChange={e=>onChange({...layout,rows:resizeBand(layout.rows,rowIndex,+e.target.value,height)})}/></Field>
      {!corner&&layout.rows.length>1&&<button type="button" className="field-icon-button" aria-label={`Ukloni red ${rowIndex+1}`} onClick={()=>onChange({...layout,rows:layout.rows.filter((_,index)=>index!==rowIndex)})}><Trash2 size={18}/></button>}
     </div>
     {row.cells.map((cell,cellIndex)=>{
      const label=`${rowIndex+1}.${cellIndex+1}`;
      return <div className="model-layout-cell" key={cellIndex}>
       <div className="model-layout-row-actions">
        <strong>Polje {label}{corner?` · ${cellIndex<corner?'levi':'desni'} krak`:''}</strong>
        {!corner&&row.cells.length>1&&<button type="button" className="field-icon-button" aria-label={`Ukloni polje ${label}`} onClick={()=>updateCells(rowIndex,row.cells.filter((_,index)=>index!==cellIndex))}><Trash2 size={17}/></button>}
       </div>
       <Field label={`Širina polja ${label} (mm)`}><NumberInput min={1} step="0.01" inputMode="decimal" disabled={row.cells.length===1} value={dimension(cell.weight,cellsTotal,width)} onChange={e=>updateCells(rowIndex,resizeBand(row.cells,cellIndex,+e.target.value,width))}/></Field>
       <Field label={`Otvaranje polja ${label}`}><select disabled={cell.infill==='space'} value={cell.movement} onChange={e=>updateCell(cellIndex,{movement:e.target.value as Movement})}>{Object.entries(movements).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></Field>
       <Field label={`Ispuna polja ${label}`}><select value={cell.infill} onChange={e=>{const infill=e.target.value as Infill;updateCell(cellIndex,infill==='space'?{infill,movement:'fixed'}:{infill});}}>{Object.entries(infills).filter(([id])=>!corner||id!=='space').map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></Field>
      </div>;
     })}
     {!corner&&row.cells.length<maxModelCells&&<button type="button" className="field-text-button" onClick={()=>updateCells(rowIndex,[...row.cells,{movement:'fixed',infill:'glass',weight:cellsTotal/row.cells.length}])}><Plus size={16}/> Dodaj polje u red {rowIndex+1}</button>}
    </fieldset>;
   })}
   {!corner&&layout.rows.length<maxModelRows&&<button type="button" className="field-text-button" onClick={()=>onChange({...layout,rows:[...layout.rows,{weight:rowsTotal/layout.rows.length,cells:[{movement:'fixed',infill:'glass',weight:1}]}]})}><Plus size={16}/> Dodaj red</button>}
  </details>
 </section>;
}
