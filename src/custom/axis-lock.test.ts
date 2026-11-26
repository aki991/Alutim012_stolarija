import {describe,it,expect} from 'vitest';
import {alignLine,axisLockMessage,constrainLockedPoint,edgeLength,ends,isGeometry,presetGeometry,resizeLine,solveLockedGeometry,toggleAxisLock,toggleEdgeLock,validateGeometry,type Geometry} from './geometry';
import {dimensionLabels} from './labels';

const sketch=():Geometry=>({version:1,preset:'free',bars:[],points:[{id:'a',x:-250,y:25},{id:'b',x:15,y:1200},{id:'c',x:1440,y:1182}],edges:[{id:'one',kind:'line',from:'a',to:'b'},{id:'two',kind:'line',from:'b',to:'c'}]});

describe('Zaključavanje vodoravnog i uspravnog pravca',()=>{
 for(const axis of ['horizontal','vertical'] as const)for(const fixed of ['from','to'] as const){
  it(`poravnava i zaključava ${axis}, fiksni kraj ${fixed}`,()=>{
   const g=sketch(),before=structuredClone(g),next=toggleAxisLock(g,'two',axis,fixed),[a,b]=ends(next,next.edges[1]),key=axis==='horizontal'?'y':'x';
   expect(a[key]).toBe(b[key]);
   expect(next.edges[1].axisLock).toEqual({axis,coordinate:a[key]});
   expect(edgeLength(next,next.edges[1])).toBeCloseTo(edgeLength(g,g.edges[1]),8);
   expect(fixed==='from'?a:b).toEqual(ends(g,g.edges[1])[fixed==='from'?0:1]);
   expect(g).toEqual(before);
  });
  it(`pomeranje čvora ostaje na istoj liniji: ${axis}, kraj ${fixed}`,()=>{
   const g=toggleAxisLock(sketch(),'two',axis,fixed),[a,b]=ends(g,g.edges[1]),moving=fixed==='from'?b:a;
   const desired=structuredClone(g),vertex=desired.points.find(p=>p.id===moving.id)!;
   Object.assign(vertex,constrainLockedPoint(g,vertex.id,{x:vertex.x+80,y:vertex.y+90}));
   const next=solveLockedGeometry(g,desired,[moving.id]),[na,nb]=ends(next,next.edges[1]),key=axis==='horizontal'?'y':'x';
   expect(na[key]).toBe(a[key]);expect(nb[key]).toBe(b[key]);
   expect(next.points.find(p=>p.id===moving.id)).toEqual(vertex);
   expect(validateGeometry(next,false)).toEqual([]);
  });
 }
 it('pravac i mera se zaključavaju i otključavaju nezavisno',()=>{
  const g=toggleEdgeLock(toggleAxisLock(sketch(),'two','horizontal'),'two');
  const noAxis=toggleAxisLock(g,'two','horizontal');
  expect(noAxis.points).toEqual(g.points);expect(noAxis.edges[1].axisLock).toBeUndefined();expect(noAxis.edges[1].locked).toEqual(g.edges[1].locked);
  const noLength=toggleEdgeLock(g,'two');expect(noLength.edges[1].locked).toBeUndefined();expect(noLength.edges[1].axisLock).toEqual(g.edges[1].axisLock);
 });
 it('zajedno zaključani mera i pravac potpuno fiksiraju stranicu',()=>{
  const g=toggleEdgeLock(toggleAxisLock(sketch(),'two','horizontal'),'two'),desired=structuredClone(g);
  for(const p of ends(desired,desired.edges[1])){p.x+=100;p.y+=200;expect(constrainLockedPoint(g,p.id,p)).toEqual({x:g.points.find(v=>v.id===p.id)!.x,y:g.points.find(v=>v.id===p.id)!.y});}
  const next=solveLockedGeometry(g,desired);expect(ends(next,next.edges[1])).toEqual(ends(g,g.edges[1]));
  expect(()=>solveLockedGeometry(g,desired,['b','c'])).toThrow(axisLockMessage);
 });
 it('menja dužinu duž zaključanog pravca',()=>{
  const g=toggleAxisLock(sketch(),'two','horizontal'),next=resizeLine(g,'two',1800);
  expect(edgeLength(next,next.edges[1])).toBeCloseTo(1800,6);
  expect(next.points[1]).toEqual(g.points[1]);expect(next.points[2].y).toBe(g.points[2].y);
 });
 it('čuva zaključane pravce i mere pri promeni susedne kose stranice',()=>{
  let g=presetGeometry('polygon');g=toggleAxisLock(toggleAxisLock(g,'e0','vertical'),'e4','horizontal');g=toggleEdgeLock(g,'e4');
  const next=resizeLine(g,'e2',edgeLength(g,g.edges[2])+120);
  expect(edgeLength(next,next.edges[2])).toBeCloseTo(edgeLength(g,g.edges[2])+120,3);
  expect(edgeLength(next,next.edges[4])).toBeCloseTo(edgeLength(g,g.edges[4]),3);
  for(const id of [0,4])for(const p of ends(next,next.edges[id]))expect(p[id===0?'x':'y']).toBe(g.edges[id].axisLock!.coordinate);
  expect(validateGeometry(next)).toEqual([]);
 });
 it('zajednički čvor vodoravne i uspravne stranice ostaje na mestu',()=>{
  const g=toggleAxisLock(toggleAxisLock(presetGeometry('polygon'),'e0','vertical'),'e4','horizontal');
  expect(constrainLockedPoint(g,'p0',{x:777,y:888})).toEqual({x:g.points[0].x,y:g.points[0].y});
 });
 it('odbija suprotan pravac i ne menja original',()=>{
  const g=toggleAxisLock(sketch(),'two','horizontal'),before=structuredClone(g);
  expect(()=>alignLine(g,'two','vertical')).toThrow(axisLockMessage);
  expect(()=>toggleAxisLock(g,'two','vertical')).toThrow(axisLockMessage);expect(g).toEqual(before);
 });
 it('odbija promenu fiksnog položaja, brisanje i spajanje zaključane stranice',()=>{
  const g=toggleAxisLock(sketch(),'two','horizontal'),desired=structuredClone(g);desired.points[1].y+=100;
  expect(()=>solveLockedGeometry(g,desired,['b'])).toThrow(axisLockMessage);
  desired.edges.pop();expect(()=>solveLockedGeometry(g,desired)).toThrow(axisLockMessage);
  const merged=structuredClone(g);merged.edges[1].to='a';expect(()=>solveLockedGeometry(g,merged)).toThrow(axisLockMessage);
 });
 it('pravougaonik poštuje zaključani položaj stranice pri izmeni mere',()=>{
  const g=toggleAxisLock(presetGeometry('rectangle'),'e2','horizontal');
  expect(()=>resizeLine(g,'e1',1900)).toThrow(axisLockMessage);
  const next=resizeLine(g,'e0',2600);expect(next.points[2].y).toBe(g.points[2].y);expect(next.points[3].y).toBe(g.points[3].y);
 });
 it('odbija nemoguće poravnanje i luk bez promene geometrije',()=>{
  const g=presetGeometry('triangle'),before=structuredClone(g);expect(()=>toggleAxisLock(g,'e0','horizontal')).toThrow();expect(g).toEqual(before);
  expect(()=>toggleAxisLock(presetGeometry('arch'),'e1','horizontal')).toThrow('pravu liniju');
 });
 it('čuva brave kroz serijalizaciju i odbija oštećene podatke',()=>{
  const g=toggleEdgeLock(toggleAxisLock(sketch(),'two','horizontal'),'two');expect(isGeometry(JSON.parse(JSON.stringify(g)))).toBe(true);expect(isGeometry(sketch())).toBe(true);
  for(const axisLock of [null,{axis:'diagonal',coordinate:0},{axis:'horizontal',coordinate:NaN},{axis:'horizontal',coordinate:Infinity},{axis:'vertical',coordinate:1000001}]){
   const bad=structuredClone(g);Object.assign(bad.edges[1],{axisLock});expect(isGeometry(bad)).toBe(false);
  }
  const arc=presetGeometry('arch');arc.edges[1].axisLock={axis:'horizontal',coordinate:0};expect(isGeometry(arc)).toBe(false);
 });
 it('otkriva narušen pravac pri validaciji i označava ga na meri',()=>{
  const g=toggleAxisLock(sketch(),'two','horizontal'),label=dimensionLabels(g,3).find(v=>v.id==='two')!;
  expect(label.text).toContain('↔');expect(label.axisLock).toBe('horizontal');expect(label.locked).toBe(false);
  g.points[2].y+=20;expect(validateGeometry(g,false)).toContain(axisLockMessage);
 });
});
