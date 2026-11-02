import {describe,it,expect} from 'vitest';
import {alignLine,distance,ends,presetGeometry,toggleEdgeLock,type Geometry} from './geometry';
const sketch=():Geometry=>({version:1,preset:'free',bars:[],points:[{id:'a',x:-250,y:25},{id:'b',x:15,y:1200},{id:'c',x:1440,y:1182}],edges:[{id:'one',kind:'line',from:'a',to:'b'},{id:'two',kind:'line',from:'b',to:'c'}]});
describe('Tačno poravnanje linije',()=>{
 for(const fixed of ['from','to'] as const)for(const axis of ['horizontal','vertical'] as const)it(`${axis}, fiksni kraj ${fixed}`,()=>{const g=sketch(),before=structuredClone(g),e=g.edges[1],length=distance(...ends(g,e)),next=alignLine(g,e.id,axis,fixed),[a,b]=ends(next,next.edges[1]);expect(axis==='horizontal'?a.y===b.y:a.x===b.x).toBe(true);expect(distance(a,b)).toBeCloseTo(length,8);expect(fixed==='from'?a:b).toEqual(ends(g,e)[fixed==='from'?0:1]);expect(g).toEqual(before);expect(next.edges[0].to).toBe(next.edges[1].from);});
 it('poravnava zaključanu liniju bez promene njene dužine',()=>{const g=toggleEdgeLock(sketch(),'two'),next=alignLine(g,'two','horizontal');expect(next.edges[1].locked).toEqual(g.edges[1].locked);expect(distance(...ends(next,next.edges[1]))).toBeCloseTo(g.edges[1].locked!.length,8);});
 it('čuva povezane zaključane mere i tačno poravnanje istovremeno',()=>{let g=presetGeometry('triangle');g.points[1].x=180;g=toggleEdgeLock(toggleEdgeLock(g,'e1'),'e2');const next=alignLine(g,'e0','vertical');expect(next.points[0].x).toBe(next.points[1].x);for(const i of [1,2])expect(distance(...ends(next,next.edges[i]))).toBeCloseTo(g.edges[i].locked!.length,3);});
 it('odbija urušavanje konture i ne dira original',()=>{const g=presetGeometry('triangle'),before=structuredClone(g);expect(()=>alignLine(g,'e0','horizontal')).toThrow();expect(g).toEqual(before);});
 it('odbija luk bez promene geometrije',()=>{const g=presetGeometry('arch');expect(()=>alignLine(g,'e1','horizontal')).toThrow('pravu liniju');});
});
