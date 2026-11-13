import { describe, expect, it } from 'vitest';
import { arcThrough, bounds, contourAngles, distance, edgeArc, edgeLength, emptyGeometry, formatAngle, isClosed, isGeometry, pointInside, presetGeometry, resizeLine, resizeRadius, signedArea, validBar, validateGeometry, type Geometry } from './geometry';
import { makeFieldPosition } from '../field-types';
import { openingRegions } from './openings';
import { calculate, defaults, positionCost, validatePosition } from '../services/calculation';
import { parseBackup } from '../services/storage';
import type { Job } from '../models';
function polygon(ps:[number,number][]):Geometry{return{version:1,preset:'free',bars:[],points:ps.map(([x,y],i)=>({id:`p${i}`,x,y})),edges:ps.map((_,i)=>({id:`e${i}`,from:`p${i}`,to:`p${(i+1)%ps.length}`,kind:'line'}))};}
const position=(g:Geometry)=>{const b=bounds(g);return{...makeFieldPosition('nacrtaj'),customGeometry:g,width:b.width,height:b.height,segments:[{width:b.width,opening:'Fiksno' as const}]};};
const job=(g:Geometry):Job=>({id:'CUSTOM',customer:{name:'Test',phone:'',email:'',address:'',building:''},date:'2026-11-02',technician:'Majstor',notes:'',status:'U izradi',positions:[position(g)],package:'Standard',discount:0,transport:0,extraWork:'',extraCost:0,validity:'',delivery:'',payment:'',updated:''});
describe('Stvarna geometrija u milimetrima',()=>{
 it('računa neokruglu dužinu bez promene stvarnih koordinata',()=>{expect(distance({x:0,y:0},{x:3,y:4})).toBe(5);const g=polygon([[0,0],[1234.56789,0],[0,750]]);expect(edgeLength(g,g.edges[0])).toBe(1234.56789);});
 for(const shape of ['triangle','trapezoid','arch','circle','polygon'] as const)it(`generiše validan početni oblik: ${shape}`,()=>{const g=presetGeometry(shape);expect(isClosed(g)).toBe(true);expect(validateGeometry(g)).toEqual([]);expect(isGeometry(g)).toBe(true);expect(validatePosition(position(g))).toEqual([]);});
 it('trapez ima dve paralelne uspravne stranice',()=>{const g=presetGeometry('trapezoid',2400,1600);expect(g.points[0].x).toBe(g.points[1].x);expect(g.points[2].x).toBe(g.points[3].x);expect(validateGeometry(g)).toEqual([]);});
 it('računa unutrašnje uglove bez oznaka na pravim i glatkim spojevima',()=>{
  const trapezoid=presetGeometry('trapezoid',2400,1600);
  expect(contourAngles(trapezoid).map(({vertex,degrees})=>[vertex.id,formatAngle(degrees)])).toEqual([['p1','99,46°'],['p2','80,54°']]);
  const concave:[number,number][]=[[0,0],[600,0],[600,300],[300,300],[300,600],[0,600]];
  for(const points of [concave,[...concave].reverse()])expect(contourAngles(polygon(points)).map(angle=>angle.degrees)).toEqual([270]);
  expect(contourAngles(presetGeometry('arch',1000,850))).toEqual([]);
  expect(contourAngles(presetGeometry('circle',1000))).toEqual([]);
 });
 it('prepoznaje otvorenu i nepovezanu konturu',()=>{const g=presetGeometry('triangle');g.edges.pop();expect(isClosed(g)).toBe(false);expect(validateGeometry(g).join()).toContain('nije zatvorena');g.edges[1].from='p2';expect(validateGeometry(g).join()).toContain('nepovezane');expect(validateGeometry(emptyGeometry()).length).toBeGreaterThan(0);});
 it('odbija samopresecanje i preklapanje pravih segmenata',()=>{expect(validateGeometry(polygon([[0,0],[2000,1600],[0,1600],[2000,0]])).join()).toContain('preseca');expect(validateGeometry(polygon([[0,0],[1000,0],[500,0],[0,700]])).join()).toContain('preseca');});
 it('izračunava pravi centar, radijus i dužinu kružnog luka',()=>{const a=arcThrough({x:0,y:500},{x:1000,y:500},{x:500,y:0});expect(a.center.x).toBeCloseTo(500);expect(a.center.y).toBeCloseTo(500);expect(a.radius).toBeCloseTo(500);expect(Math.abs(a.delta)).toBeCloseTo(Math.PI);const g=presetGeometry('circle',1000);expect(edgeLength(g,g.edges[0])).toBeCloseTo(500*Math.PI);expect(signedArea(g)).toBeCloseTo(Math.PI*500**2);});
 it('odbija kolinearne tačke luka i oštećen kontrolni čvor',()=>{expect(()=>arcThrough({x:0,y:0},{x:1000,y:0},{x:500,y:0})).toThrow('istoj pravoj');const g=presetGeometry('circle');g.edges[0].via={x:1200,y:1200};expect(validateGeometry(g).join()).toContain('istoj pravoj');});
 it('analitički proverava presecanje linije sa lukom',()=>{const g=polygon([[0,1000],[2000,1000],[1000,-1000],[1000,500]]);g.edges[0]={...g.edges[0],kind:'arc',via:{x:1000,y:0}};expect(validateGeometry(g).join()).toContain('preseca');});
 it('menja dužinu pomeranjem izabranog kraja i čuva spoj susedne stranice',()=>{const g=presetGeometry('triangle'),before=structuredClone(g),next=resizeLine(g,'e0',2000,'from');expect(next.points[0]).toEqual(g.points[0]);expect(edgeLength(next,next.edges[0])).toBeCloseTo(2000);expect(next.edges[0].to).toBe(next.edges[1].from);expect(next.points[1].y).toBe(-400);expect(g).toEqual(before);const anchored=resizeLine(g,'e0',1800,'to');expect(anchored.points[1]).toEqual(g.points[1]);expect(edgeLength(anchored,anchored.edges[0])).toBeCloseTo(1800);});
 it('ne prihvata izmenu koja urušava konturu',()=>{const g=presetGeometry('triangle');expect(()=>resizeLine(g,'e0',0)).toThrow();expect(()=>resizeLine(g,'e0',Infinity)).toThrow();});
 it('uređuje radijus sa fiksnim krajevima i odbija premali radijus',()=>{const g=presetGeometry('arch',1200,1400),e=g.edges[1],next=resizeRadius(g,e.id,900);expect(next.points).toEqual(g.points);expect(edgeArc(next,next.edges[1]).radius).toBeCloseTo(900);expect(validateGeometry(next)).toEqual([]);expect(()=>resizeRadius(g,e.id,599)).toThrow('polovina tetive');});
 it('vezuje polukružni vrh za širinu i proverava ukupnu visinu',()=>{const g=presetGeometry('arch',1800,2200);expect(edgeArc(g,g.edges[1]).radius).toBeCloseTo(900);expect(bounds(g).height).toBeCloseTo(2200);expect(()=>presetGeometry('arch',1800,899)).toThrow('polovina širine');expect(validateGeometry(presetGeometry('arch',1800,900))).toEqual([]);});
 it('okrugli prozor ima zadati prečnik u oba pravca',()=>{const g=presetGeometry('circle',1250);expect(bounds(g).width).toBeCloseTo(1250);expect(bounds(g).height).toBeCloseTo(1250);});
 it('prepoznaje unutrašnjost pravolinijskih i lučnih kontura',()=>{for(const shape of ['arch','circle','trapezoid'] as const){const g=presetGeometry(shape,1200,1400);expect(pointInside(g,{x:600,y:600})).toBe(true);expect(pointInside(g,{x:-10,y:600})).toBe(false);}const g=presetGeometry('circle',1200);expect(pointInside(g,{x:1,y:1})).toBe(false);});
 it('prihvata povezanu unutrašnju prečku i odbija spoljašnju i viseću',()=>{const g=polygon([[0,0],[2000,0],[2000,1600],[0,1600]]),b={id:'b',a:{x:1000,y:0},b:{x:1000,y:1600}};expect(validBar(g,b)).toBe(true);g.bars.push(b);expect(validateGeometry(g)).toEqual([]);expect(validBar(g,{id:'x',a:{x:1000,y:500},b:{x:2000,y:500}})).toBe(true);expect(validBar(g,{id:'x',a:{x:50,y:50},b:{x:1500,y:50}})).toBe(false);});
 it('odbija prečku koja prelazi udubljenje konkavne konture',()=>{const g=polygon([[0,0],[2000,0],[2000,2000],[1300,2000],[1300,700],[700,700],[700,2000],[0,2000]]);expect(validateGeometry(g)).toEqual([]);expect(validBar(g,{id:'b',a:{x:0,y:1500},b:{x:2000,y:1500}})).toBe(false);});
 it('serijalizuje i ponovo učitava geometriju i prečke kroz postojeću rezervnu kopiju',()=>{const g=presetGeometry('arch',1600,2000);g.bars=[{id:'b',a:{x:0,y:1600},b:{x:1600,y:1600}}];const data={settings:defaults,jobs:[job(g)]};expect(parseBackup(JSON.parse(JSON.stringify(data))).jobs[0].positions[0].customGeometry).toEqual(g);const bad=structuredClone(data);bad.jobs[0].positions[0].customGeometry!.points[0].x=NaN;expect(()=>parseBackup(bad)).toThrow();});
 it('čuva namenu, ram i puni panel kroz rezervnu kopiju',()=>{const j=job(presetGeometry('arch'));Object.assign(j.positions[0],{customKind:'door',customFrameMm:85,customInfill:'panel'});const loaded=parseBackup(JSON.parse(JSON.stringify({settings:defaults,jobs:[j]}))).jobs[0].positions[0];expect(loaded.customKind).toBe('door');expect(loaded.customFrameMm).toBe(85);expect(loaded.customInfill).toBe('panel');expect(loaded.customGeometry).toEqual(j.positions[0].customGeometry);loaded.customFrameMm=10;expect(()=>parseBackup({settings:defaults,jobs:[{...j,positions:[loaded]}]})).toThrow();});
 it('proverava strukturu ID-jeva i numeričke mere sačuvanog crteža',()=>{const g=presetGeometry('triangle');g.edges[0].from='missing';expect(isGeometry(g)).toBe(false);const p=position(presetGeometry('triangle'));p.width+=20;expect(validatePosition(p).join()).toContain('ne odgovaraju');});
 it('obračunava čisti polukrug po stvarnoj površini, obimu i dužini luka',()=>{
  const g=presetGeometry('arch',1000,500);
  const p={...position(g),installation:true};
  const price=positionCost(p,defaults);
  const area=Math.PI*.5**2/2,arc=Math.PI*.5;
  expect(price.area).toBeCloseTo(area);
  expect(price.perimeter).toBeCloseTo(1+arc);
  expect(price.unit).toBeCloseTo(area*(110+32)+arc*48+40+(1+arc)*9);
  expect(calculate(job(g),defaults).hasUnpriced).toBe(false);
  expect(positionCost({...p,manualPrice:0},defaults).total).toBe(0);
 });
 it('naplaćuje zaokretno-otklopni okov jednom po označenom polju i čuva izbor',()=>{
  const g=presetGeometry('rectangle',1000,1200);
  const [{id:region}]=openingRegions(g);
  const ordinary={...g,openings:[{region,side:'right' as const}]};
  const tilt={...g,openings:[{region,side:'right' as const,tilt:true as const}]};
  const loaded=parseBackup({settings:defaults,jobs:[job(tilt)]}).jobs[0].positions[0];
  expect(loaded.customGeometry?.openings).toEqual(tilt.openings);
  expect(positionCost(loaded,defaults).unit-positionCost(position(ordinary),defaults).unit).toBeCloseTo(12);
 });
});
