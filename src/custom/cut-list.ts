import type { Position } from '../models';
import { bounds, contourAngles, contourCorners, edgeArc, edgeLength, ends, validateGeometry, type Geometry } from './geometry';
import { isDoorBottomEdge } from '../door-bottom';

export interface ProfileCut {
 vertex:string;interior:number;angle:number|null;saw:number|null;concave:boolean;
 reason?:'arc'|'threshold'|'open';
}
export interface CutListRow {
 id:string;label:string;from:string;to:string;length:number;quantity:number;
 kind:'frame'|'arc'|'threshold';radius?:number;start:ProfileCut;end:ProfileCut;
}
export interface ElementCuttingList {geometry:Geometry;rows:CutListRow[];hasBars:boolean}

export function cornerLabel(index:number):string{
 let label='';
 for(let n=index+1;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;
 return label;
}

// Angles are unsigned magnitudes; the diagram and concave flag identify the joint orientation.
// Saw conventions: Bosch GAM 270 MFL manual, p. 13 (0-degree vs 90-degree square-cut scales).
// https://ocsmedia.boschtools.com/binary/manualsmedia/o176666v2_2610038337_0216_GAM270MFL.pdf
export function miterCut(interior:number){
 const angle=Math.min(interior,360-interior)/2;
 return {angle,saw:90-angle,concave:interior>180};
}

export function elementCutList(position:Position):ElementCuttingList|null{
 const g=position.customGeometry;
 if(!g||validateGeometry(g).length||!contourAngles(g).length)return null;
 const corners=new Map(contourCorners(g).map(corner=>[corner.vertex.id,corner.degrees]));
 const labels=new Map(g.edges.map((edge,index)=>[edge.from,cornerLabel(index)]));
 const box=bounds(g);
 const threshold=(index:number)=>{
  const edge=g.edges[index],[a,b]=ends(g,edge);
  return position.customKind==='door'&&position.doorBottom==='alu24'&&edge.kind==='line'
   &&Math.abs(a.y-b.y)<.01&&Math.abs(a.y-(box.y+box.height))<.01;
 };
 const omitted=(index:number)=>position.customKind==='door'&&position.doorBottom==='none'&&isDoorBottomEdge(g,g.edges[index]);
 const cut=(index:number):ProfileCut=>{
  const previous=(index+g.edges.length-1)%g.edges.length;
  const vertex=labels.get(g.edges[index].from)!,interior=corners.get(g.edges[index].from)??180;
  const reason=omitted(index)||omitted(previous)?'open':threshold(index)||threshold(previous)?'threshold'
   :g.edges[index].kind==='arc'||g.edges[previous].kind==='arc'?'arc':undefined;
  return {vertex,interior,...(reason?{angle:null,saw:null,concave:interior>180,reason}:miterCut(interior))};
 };
 const rows=g.edges.flatMap((edge,index):CutListRow[]=>omitted(index)?[]:[{
  id:edge.id,label:`P${index+1}`,from:labels.get(edge.from)!,to:labels.get(edge.to)!,
  length:edgeLength(g,edge),quantity:position.quantity,
  kind:threshold(index)?'threshold':edge.kind==='arc'?'arc':'frame',
  radius:edge.kind==='arc'?edgeArc(g,edge).radius:undefined,
  start:cut(index),end:cut((index+1)%g.edges.length),
 }]);
 return {geometry:g,rows,hasBars:g.bars.length>0};
}

export const cutListNotes=[
 'Uglovi važe za ram iste širine i spojeve na pola ugla. Rez je ugao prema uzdužnoj osi profila.',
 'Testera je podešavanje na skali na kojoj je prav rez 0°. Na skali sa pravim rezom 90° koristite vrednost Rez.',
 'Dužine su spoljne mere iz crteža, bez dodataka za varenje, širinu reza i obrade sistema profila.',
];
export const specialCutText=(cut:ProfileCut)=>cut.reason==='open'?'Slobodan kraj bez praga - prema sistemu profila':cut.reason==='threshold'?'Spoj sa pragom - prema sistemu profila':'Spoj sa lukom - po šablonu';
