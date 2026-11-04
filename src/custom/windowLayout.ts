import { bounds, distance, edgeArc, ends, lineArc, lineLine, pointAt, validateGeometry, type Bar, type Geometry, type Point } from './geometry';

export type FixedPanels = { top: number; bottom: number; left: number; right: number };

export function archTopOffset(g: Geometry) {
 const {y, height} = bounds(g);
 for (const edge of g.edges) {
  if (edge.kind !== 'arc') continue;
  const [a, b] = ends(g, edge);
  if (Math.abs(a.y-b.y) < .001 && a.y-y > 1 && a.y < y+height-1 && pointAt(g,edge,.5).y < a.y) return a.y-y;
 }
 return 0;
}

// Find the exact endpoints on the outer contour, including curved edges.
function contourSpan(g: Geometry, a: Point, b: Point, axis: 'x'|'y') {
 const points: Point[] = [];
 for (const edge of g.edges) {
  const [from, to] = ends(g, edge);
  if (edge.kind === 'line') {
   const hit = lineLine(a,b,from,to);
   if (hit.overlap) throw Error('Prečka se poklapa sa spoljašnjom ivicom.');
   points.push(...hit.points);
  } else {
   points.push(...lineArc(a,b,edgeArc(g,edge)));
  }
 }
 const ordered = points.sort((p,q)=>p[axis]-q[axis]);
 const distinct = ordered.filter((p,i)=>i===0||distance(p,ordered[i-1])>.001);
 if (distinct.length !== 2) throw Error('Na ovoj meri prečka ne može da spoji dve ivice. Promenite meru ili je nacrtajte ručno.');
 return distinct as [Point, Point];
}

export function divideWindow(g: Geometry, fixed: FixedPanels, middleLeaves: 1|2): Geometry {
 const next: Geometry = {...g,bars:[],openings:[]};
 const errors = validateGeometry(next);
 if (errors.length) throw Error(errors[0]);
 const {x,y,width,height} = bounds(next);
 if (Object.values(fixed).some(value=>!Number.isFinite(value)||value<0)) throw Error('Unesite nenegativne mere fiksnih polja.');
 const middleWidth = width-fixed.left-fixed.right;
 const middleHeight = height-fixed.top-fixed.bottom;
 if (middleWidth <= 1 || middleHeight <= 1) throw Error('Fiksna polja moraju da ostave prostor za srednji deo.');

 const bars: Bar[] = [];
 const top = y+fixed.top, bottom = y+height-fixed.bottom;
 for (const [id, offset, level] of [['top',fixed.top,top],['bottom',fixed.bottom,bottom]] as const) {
  if (offset === 0) continue;
  const [a,b] = contourSpan(next,{x:x-1,y:level},{x:x+width+1,y:level},'x');
  bars.push({id:`layout-${id}`,a,b});
 }
 const centerLeft = x+fixed.left, centerRight = x+width-fixed.right;
 const divisions = [
  {id:'left', enabled:fixed.left>0, x:centerLeft},
  {id:'middle', enabled:middleLeaves===2, x:(centerLeft+centerRight)/2},
  {id:'right', enabled:fixed.right>0, x:centerRight},
 ];
 for (const division of divisions) {
  if (!division.enabled) continue;
  const [a,b] = contourSpan(next,{x:division.x,y:y-1},{x:division.x,y:y+height+1},'y');
  const upper = Math.max(a.y,top), lower = Math.min(b.y,bottom);
  if (lower-upper <= 1) throw Error('Uspravna prečka mora da se nalazi unutar srednjeg dela.');
  bars.push({id:`layout-${division.id}`,a:{x:division.x,y:upper},b:{x:division.x,y:lower}});
 }
 next.bars = bars;
 const dividedErrors = validateGeometry(next);
 if (dividedErrors.length) throw Error(dividedErrors[0]);
 return next;
}
