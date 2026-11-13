import { distance, edgeArc, ends, isClosed, lineLine, pointAt, projectEdge, projectLine, type CustomOpening, type Geometry, type Point } from './geometry';

export type HingeSide = 'left' | 'right';
export const hingeLabel = (side: HingeSide) => side === 'left' ? 'Šarke levo' : 'Šarke desno';
export const customOpeningLabel=(mark:CustomOpening)=>mark.side==='bottom'?'Kip, šarke dole':`${hingeLabel(mark.side)}${mark.tilt?' + kip':''}`;
export type OpeningRegion = { id: string; points: Point[]; center: Point };

type Segment = { id: string; points: Point[] };
type Vertex = Point & { links: HalfEdge[] };
type HalfEdge = { from: Vertex; to: Vertex; source: string; reverse?: HalfEdge; seen?: boolean };

export function regionContains(region: OpeningRegion, point: Point) {
 let inside = false;
 for (let i = 0; i < region.points.length; i++) {
  const a = region.points[i], b = region.points[(i + 1) % region.points.length];
  if ((a.y > point.y) !== (b.y > point.y) && point.x < a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y)) inside = !inside;
 }
 return inside;
}

// Walk the bounded faces of the contour and its divider bars. Arc sampling is
// only for drawing and picking fields, with bar endpoints inserted exactly.
export function openingRegions(g: Geometry): OpeningRegion[] {
 if (!isClosed(g)) return [];
 const bars: Segment[] = g.bars.map(bar => ({ id: bar.id, points: [bar.a, bar.b] }));
 for (let i = 0; i < bars.length; i++) {
  const {a, b} = g.bars[i];
  for (let j = i + 1; j < bars.length; j++) {
   const other = g.bars[j];
   const intersection = lineLine(a, b, other.a, other.b);
   for (const point of intersection.points) {
    bars[i].points.push(point);
    bars[j].points.push(point);
   }
   if (intersection.overlap) {
    for (const point of [a, b]) if (distance(point, projectLine(point, other.a, other.b)) < .001) bars[j].points.push(point);
    for (const point of [other.a, other.b]) if (distance(point, projectLine(point, a, b)) < .001) bars[i].points.push(point);
   }
  }
  bars[i].points.sort((p, q) => distance(a, p) - distance(a, q));
 }
 const tips = g.bars.flatMap(bar => [bar.a, bar.b]);
 const segments: Segment[] = [];
 try {
  for (const edge of g.edges) {
   const [a,b] = ends(g, edge);
   const attached = tips.filter(point => distance(point, projectEdge(g, edge, point)) < .001);
   if (edge.kind === 'line') {
    segments.push({id: edge.id, points: [a, ...attached, b].sort((p,q) => distance(a,p) - distance(a,q))});
   } else {
    const arc = edgeArc(g, edge), count = Math.ceil(Math.abs(arc.delta) / (Math.PI / 48));
    const angleProgress = (point: Point) => {
     const delta = Math.sign(arc.delta) * (Math.atan2(point.y - arc.center.y, point.x - arc.center.x) - arc.start);
     const angle = ((delta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
     return distance(point, a) < .001 ? 0 : angle;
    };
    const points = Array.from({length: count - 1}, (_, i) => pointAt(g, edge, (i + 1) / count));
    segments.push({id: edge.id, points: [a, ...[...points, ...attached].filter(p => distance(p,a) >= .001 && distance(p,b) >= .001).sort((p,q) => angleProgress(p) - angleProgress(q)), b]});
   }
  }
 } catch {
  return [];
 }
 const vertices = new Map<string, Vertex>();
 function vertex(p: Point) {
  const key = `${Math.round(p.x * 10000)},${Math.round(p.y * 10000)}`;
  let node = vertices.get(key);
  if (!node) { node = {...p, links: []}; vertices.set(key, node); }
  return node;
 }
 for (const segment of [...segments, ...bars]) {
  for (let i = 1; i < segment.points.length; i++) {
   const from = vertex(segment.points[i - 1]), to = vertex(segment.points[i]);
   if (from === to || from.links.some(link => link.to === to)) continue;
   const forward: HalfEdge = {from, to, source: '+' + segment.id};
   const reverse: HalfEdge = {from: to, to: from, source: '-' + segment.id, reverse: forward};
   forward.reverse = reverse;
   from.links.push(forward);
   to.links.push(reverse);
  }
 }
 const angle = (edge: HalfEdge) => Math.atan2(edge.to.y - edge.from.y, edge.to.x - edge.from.x);
 for (const node of vertices.values()) node.links.sort((a,b) => angle(a)-angle(b));
 const regions: OpeningRegion[] = [];
 for (const node of vertices.values()) for (const first of node.links) {
  if (first.seen) continue;
  const points: Point[] = [], sources = new Set<string>();
  let area = 0, x = 0, y = 0, edge = first;
  do {
   edge.seen = true;
   const {from, to} = edge;
   points.push({x: from.x, y: from.y});
   sources.add(edge.source);
   const cross = from.x * to.y - to.x * from.y;
   area += cross;
   x += (from.x + to.x) * cross;
   y += (from.y + to.y) * cross;
   edge = to.links[(to.links.indexOf(edge.reverse!) + to.links.length - 1) % to.links.length];
  } while (!edge.seen);
  if (edge === first && area > 1) regions.push({id: JSON.stringify([...sources].sort()), points, center: {x: x/(3*area), y: y/(3*area)}});
 }
 regions.sort((a,b) => a.center.x - b.center.x || a.center.y - b.center.y);
 const occurrences = new Map<string,number>();
 return regions.map(region => {
  const index = occurrences.get(region.id) ?? 0;
  occurrences.set(region.id, index + 1);
  return {...region, id: region.id + ':' + index};
 });
}
