import type { Position } from './models';
import type { ModelCell } from './model-layout';

export type EqualMode='all'|'opening'|'fixed';
export const equalModeLabels:Record<EqualMode,string>={all:'Sva polja jednaka',opening:'Krila jednaka',fixed:'Fiksna polja jednaka'};

interface FieldWidth { width:number; fixed:boolean; integer?:boolean }
const round=(value:number)=>Math.round(value*100)/100;
const members=(fields:FieldWidth[],mode:EqualMode)=>fields.flatMap((field,index)=>mode==='all'||(mode==='fixed')===field.fixed?[index]:[]);

/** Modes that make sense for a row: only rows with more than two fields, and only groups of two or more. */
export function equalModesFor(fields:FieldWidth[]):EqualMode[]{
 if(fields.length<3)return [];
 return (['all','opening','fixed'] as EqualMode[]).filter(mode=>mode==='all'||members(fields,mode).length>=2);
}

/** Share the group's current total equally; fields outside the group and the overall width stay unchanged. */
export function equalizeWidths(fields:FieldWidth[],mode:EqualMode):number[]{
 const group=members(fields,mode),widths=fields.map(field=>field.width);
 if(group.length<2)return widths;
 const total=group.reduce((sum,index)=>sum+fields[index].width,0),each=total/group.length;
 for(const index of group)widths[index]=fields[index].integer?Math.round(each):round(each);
 // The remainder goes to a field that accepts decimals, so integer-only fields stay whole.
 const remainderAt=[...group].reverse().find(index=>!fields[index].integer)??group.at(-1)!;
 widths[remainderAt]=round(total-group.filter(index=>index!==remainderAt).reduce((sum,index)=>sum+widths[index],0));
 return widths;
}

const modelRows=(p:Position)=>p.modelLayout&&p.modelLayout.cornerAfter===undefined?p.modelLayout.rows:[];
const cellFields=(cells:ModelCell[])=>cells.flatMap((cell,index)=>cell.infill==='space'?[]:[{index,width:cell.weight,fixed:cell.movement==='fixed'}]);

/** Side fixed panels count as fields next to the leaves; they are stored in whole millimetres. */
function segmentFields(p:Position):FieldWidth[]{
 const left=p.fixedPanels?.left??0,right=p.fixedPanels?.right??0;
 return [
  ...(left?[{width:left,fixed:true,integer:true}]:[]),
  ...p.segments.map(s=>({width:s.width,fixed:s.opening==='Fiksno'})),
  ...(right?[{width:right,fixed:true,integer:true}]:[]),
 ];
}

export function equalModesForPosition(p:Position):EqualMode[]{
 if(p.customGeometry||p.combination||p.portaRoyal||p.category==='Roletne')return [];
 if(p.modelLayout){
  const modes=new Set(modelRows(p).flatMap(row=>equalModesFor(cellFields(row.cells))));
  return (['all','opening','fixed'] as EqualMode[]).filter(mode=>modes.has(mode));
 }
 return equalModesFor(segmentFields(p));
}

export function equalizePosition(p:Position,mode:EqualMode):Partial<Position>{
 if(p.modelLayout){
  if(p.modelLayout.cornerAfter!==undefined)return {};
  const rows=p.modelLayout.rows.map(row=>{
   const fields=cellFields(row.cells);
   if(!equalModesFor(fields).includes(mode))return row;
   const weights=equalizeWidths(fields,mode),cells=row.cells.map(cell=>({...cell}));
   fields.forEach((field,k)=>{cells[field.index].weight=weights[k];});
   return {...row,cells};
  });
  return {modelLayout:{...p.modelLayout,rows}};
 }
 const widths=equalizeWidths(segmentFields(p),mode);
 const left=p.fixedPanels?.left?widths.shift()!:0,right=p.fixedPanels?.right?widths.pop()!:0;
 const segments=p.segments.map((s,i)=>({...s,width:widths[i]}));
 return p.fixedPanels?{segments,fixedPanels:{...p.fixedPanels,left,right}}:{segments};
}
