import type { Opening, Position, Segment } from './models';

export type CombinationPart='door'|'window';
export type MainLeaf='left'|'right';
export const mainLeafLabels:Record<MainLeaf|'both',string>={left:'Levo',right:'Desno',both:'Oba'};

const sum=(segments:Segment[])=>segments.reduce((total,s)=>total+s.width,0);
const round=(value:number)=>Math.round(value*100)/100;

/** Segments are stored door leaves first, then window leaves. Older positions have one leaf per part. */
export function doorLeafCount(p:Pick<Position,'combination'|'segments'>){
 const count=p.combination?.doorLeaves??1;
 return Math.max(1,Math.min(count,p.segments.length-1));
}

export function combinationParts(p:Pick<Position,'combination'|'segments'>){
 const doorLeaves=doorLeafCount(p),door=p.segments.slice(0,doorLeaves),window=p.segments.slice(doorLeaves);
 return {doorLeaves,windowLeaves:window.length,door,window,doorWidth:sum(door),windowWidth:sum(window)};
}

export const partLeaves=(p:Pick<Position,'combination'|'segments'>,part:CombinationPart)=>combinationParts(p)[part];
export const partWidth=(p:Pick<Position,'combination'|'segments'>,part:CombinationPart)=>combinationParts(p)[part==='door'?'doorWidth':'windowWidth'];
/** Index of the first segment of a part inside position.segments. */
export const partStart=(p:Pick<Position,'combination'|'segments'>,part:CombinationPart)=>part==='door'?0:doorLeafCount(p);

const defaultOpenings:Record<CombinationPart,Opening[][]>={
 door:[['Levo + kip'],['Levo','Desno']],
 window:[['Desno + kip'],['Levo + kip','Desno']],
};

function withPart(p:Position,part:CombinationPart,leaves:Segment[]):Partial<Position>{
 const {door,window}=combinationParts(p);
 const nextDoor=part==='door'?leaves:door,nextWindow=part==='window'?leaves:window;
 const segments=[...nextDoor,...nextWindow];
 return {segments,width:round(sum(segments)),combination:{...p.combination!,doorLeaves:nextDoor.length}};
}

/** Change a part between one and two leaves without changing its outer width. */
export function setPartLeafCount(p:Position,part:CombinationPart,count:number):Partial<Position>{
 const current=partLeaves(p,part),width=partWidth(p,part);
 if(current.length===count)return {};
 const openings=defaultOpenings[part][count-1]??defaultOpenings[part][1];
 const leaves=Array.from({length:count},(_,i)=>({width:round(width/count),opening:count===1?current[0]?.opening??openings[0]:openings[i]??'Desno'}));
 if(count>1)leaves[count-1].width=round(width-leaves.slice(0,-1).reduce((total,s)=>total+s.width,0));
 const patch=withPart(p,part,leaves);
 if(part==='door'&&count!==2)patch.mainLeaf=undefined;
 return patch;
}

/** Resize a whole part and keep the proportions of its leaves. */
export function resizePart(p:Position,part:CombinationPart,width:number):Partial<Position>{
 const leaves=partLeaves(p,part),old=sum(leaves);
 const next=leaves.map(s=>({...s,width:round(old>0?s.width/old*width:width/leaves.length)}));
 if(next.length>1)next[next.length-1].width=round(width-next.slice(0,-1).reduce((total,s)=>total+s.width,0));
 return withPart(p,part,next);
}

/** Resize one leaf of a two-leaf part; the neighbouring leaf takes the difference. */
export function resizePartLeaf(p:Position,part:CombinationPart,leaf:number,width:number):Partial<Position>{
 const leaves=partLeaves(p,part),total=sum(leaves);
 if(leaves.length<2)return resizePart(p,part,width);
 const other=leaf===0?1:0;
 const next=leaves.map((s,i)=>i===leaf?{...s,width:round(width)}:i===other?{...s,width:round(total-width)}:s);
 return withPart(p,part,next);
}

export function setPartOpening(p:Position,part:CombinationPart,leaf:number,opening:Opening):Partial<Position>{
 return withPart(p,part,partLeaves(p,part).map((s,i)=>i===leaf?{...s,opening}:s));
}

/** Door leaves (indices into position.segments) of a two-leaf door, or null for any other element. */
export function doubleDoorLeaves(p:Position):[number,number]|null{
 if(p.customGeometry||p.modelLayout||p.portaRoyal)return null;
 if(p.combination)return doorLeafCount(p)===2?[0,1]:null;
 const door=p.category==='Vrata'||p.category==='Ulazna vrata'||p.elementType==='balkonska'||p.elementType==='vrata';
 return door&&p.segments.length===2&&p.segments.every(s=>s.opening!=='Fiksno'&&s.opening!=='Klizno')?[0,1]:null;
}

/** Leaves that carry the handle; with no main leaf chosen both leaves are main. */
export function mainLeafIndices(p:Position):number[]{
 const leaves=doubleDoorLeaves(p);
 if(!leaves)return [];
 return p.mainLeaf==='left'?[leaves[0]]:p.mainLeaf==='right'?[leaves[1]]:leaves;
}

export function mainLeafText(p:Position){
 if(!doubleDoorLeaves(p))return undefined;
 return p.mainLeaf==='left'?'Glavno krilo: levo':p.mainLeaf==='right'?'Glavno krilo: desno':'Glavno krilo: oba krila glavna';
}
