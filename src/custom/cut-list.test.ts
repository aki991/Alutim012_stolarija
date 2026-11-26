import { describe, expect, it } from 'vitest';
import { makeFieldPosition } from '../field-types';
import { contourCorners, formatAngle, presetGeometry, type Geometry } from './geometry';
import { cornerLabel, elementCutList, miterCut } from './cut-list';

const position=(geometry:Geometry)=>({...makeFieldPosition('nacrtaj'),quantity:2,customGeometry:geometry});
const polygon=(points:[number,number][]):Geometry=>({version:1,preset:'free',bars:[],points:points.map(([x,y],i)=>({id:`p${i}`,x,y})),edges:points.map((_,i)=>({id:`e${i}`,from:`p${i}`,to:`p${(i+1)%points.length}`,kind:'line'}))});

describe('Krojna lista spoljašnjeg rama',()=>{
 it('trapez sa slike dobija stvarne spoljne dužine i dva različita ugla reza, bez zaokruživanja proračuna',()=>{
  const g=presetGeometry('trapezoid',2400,1600),before=structuredClone(g),list=elementCutList(position(g))!;
  expect(list.rows.map(row=>row.length)).toEqual([1200,Math.hypot(2400,400),1600,2400]);
  expect(list.rows.map(row=>row.quantity)).toEqual([2,2,2,2]);
  expect(list.rows[0].from).toBe('A');expect(list.rows[0].to).toBe('B');
  expect(formatAngle(list.rows[0].start.angle!)).toBe('45°');
  expect(formatAngle(list.rows[0].end.angle!)).toBe('49,73°');
  expect(formatAngle(list.rows[0].end.saw!)).toBe('40,27°');
  expect(formatAngle(list.rows[1].end.angle!)).toBe('40,27°');
  expect(formatAngle(list.rows[1].end.saw!)).toBe('49,73°');
  expect(list.rows[0].end.angle!+list.rows[0].end.saw!).toBeCloseTo(90,12);
  expect(list.rows[1].length).not.toBe(Math.round(list.rows[1].length));expect(g).toEqual(before);
 });
 it('ne prikazuje listu za pravougaonik, otvorenu ili nevažeću konturu, niti za glatki kružni okvir',()=>{
  for(const shape of ['rectangle','circle','arch'] as const)expect(elementCutList(position(presetGeometry(shape,1200,1600)))).toBeNull();
  const open=presetGeometry('triangle');open.edges.pop();expect(elementCutList(position(open))).toBeNull();
  expect(elementCutList(position(polygon([[0,0],[1000,1000],[0,1000],[1000,0]])))).toBeNull();
 });
 it('uglovi i rezovi ne zavise od smera obilaska ili translacije konture',()=>{
  const vertices:[number,number][]=[[0,1200],[0,0],[2400,-400],[2400,1200]];
  const cuts=(points:[number,number][])=>elementCutList(position(polygon(points)))!.rows.flatMap(row=>[row.start.angle!]).sort((a,b)=>a-b);
  const original=cuts(vertices);
  cuts([...vertices].reverse()).forEach((cut,index)=>expect(cut).toBeCloseTo(original[index],10));
  cuts(vertices.map(([x,y])=>[x-700,y+3000])).forEach((cut,index)=>expect(cut).toBeCloseTo(original[index],10));
 });
 it('pravi spoj ima rez 90° i podešavanje testere 0°, a uvučeni spojevi imaju oznaku orijentacije',()=>{
  expect(miterCut(180)).toEqual({angle:90,saw:0,concave:false});
  expect(miterCut(270)).toEqual({angle:45,saw:45,concave:true});
  const list=elementCutList(position(polygon([[0,0],[600,0],[600,300],[300,300],[300,600],[0,600]])))!;
  expect(list.rows.flatMap(row=>[row.start]).filter(cut=>cut.concave)).toHaveLength(1);
 });
 it('ne izmišlja običan miter na spoju luka ili praga različite širine',()=>{
  const g=polygon([[0,1000],[0,0],[1200,-300],[1200,1000]]);
  const door={...position(g),customKind:'door' as const,doorBottom:'alu24' as const};
  const rows=elementCutList(door)!.rows;
  expect(rows[3].kind).toBe('threshold');expect(rows[0].start).toMatchObject({angle:null,reason:'threshold'});
  expect(rows[2].end).toMatchObject({angle:null,reason:'threshold'});
  const curved=structuredClone(g);curved.edges[1]={...curved.edges[1],kind:'arc',via:{x:600,y:-600}};
  const arcs=elementCutList(position(curved))!.rows;
  expect(arcs[1].radius).toBeGreaterThan(0);expect(arcs[1].start).toMatchObject({angle:null,reason:'arc'});
  expect(arcs[0].end.angle).toBeNull();
 });
 it('zadržava standardne uglove za kompletan ram i oznake preko 26 tačaka',()=>{
  expect(contourCorners(presetGeometry('rectangle'))).toHaveLength(4);
  expect(cornerLabel(0)).toBe('A');expect(cornerLabel(25)).toBe('Z');expect(cornerLabel(26)).toBe('AA');
 });
});
