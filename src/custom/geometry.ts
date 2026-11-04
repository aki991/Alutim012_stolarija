export type Point={x:number;y:number};
export type Vertex=Point&{id:string};
export type Edge={id:string;from:string;to:string;kind:'line'|'arc';via?:Point;locked?:{length:number;radius?:number}};
export type Bar={id:string;a:Point;b:Point};
export type Shape='free'|'rectangle'|'triangle'|'trapezoid'|'arch'|'circle'|'polygon';
export type Geometry={version:1;points:Vertex[];edges:Edge[];bars:Bar[];preset:Shape;openings?:{region:string;side:'left'|'right'}[]};
export const emptyGeometry=():Geometry=>({version:1,points:[],edges:[],bars:[],preset:'free'});
const TAU=Math.PI*2,EPS=1e-6;
export const distance=(a:Point,b:Point)=>Math.hypot(b.x-a.x,b.y-a.y);
const mod=(n:number)=>((n%TAU)+TAU)%TAU;
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
const sub=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
// Round only presentation; stored coordinates and locked constraints retain precision.
export const fmt=(n:number)=>String(Math.round(n));
export function ends(g:Geometry,e:Edge){return [g.points.find(p=>p.id===e.from)!,g.points.find(p=>p.id===e.to)!] as const;}
export function arcThrough(a:Point,b:Point,c:Point){
 const u=sub(b,a),v=sub(c,a),d=2*cross(u,v);
 if(Math.abs(d)<1e-8*Math.max(dot(u,u),dot(v,v),1))throw Error('Tačke luka su na istoj pravoj. Pomerite kontrolnu tačku.');
 const center={x:a.x+(v.y*dot(u,u)-u.y*dot(v,v))/d,y:a.y+(u.x*dot(v,v)-v.x*dot(u,u))/d};
 const radius=distance(a,center),start=Math.atan2(a.y-center.y,a.x-center.x),end=Math.atan2(b.y-center.y,b.x-center.x),via=Math.atan2(c.y-center.y,c.x-center.x);
 const forward=mod(end-start),delta=mod(via-start)<=forward+EPS?forward:forward-TAU;
 if(!Number.isFinite(radius)||radius>1e7||Math.abs(delta)<EPS)throw Error('Luk je previše ravan ili nevažeći.');
 return {center,radius,start,delta};
}
export function edgeArc(g:Geometry,e:Edge){const [a,b]=ends(g,e);return arcThrough(a,b,e.via!);}
function onArc(arc:ReturnType<typeof arcThrough>,p:Point,tol=EPS){const angle=Math.atan2(p.y-arc.center.y,p.x-arc.center.x);const progress=arc.delta>0?mod(angle-arc.start):mod(arc.start-angle);return progress<=Math.abs(arc.delta)+tol||TAU-progress<=tol;}
export function pointAt(g:Geometry,e:Edge,t:number):Point{const [a,b]=ends(g,e);if(e.kind==='line')return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};const arc=edgeArc(g,e),angle=arc.start+arc.delta*t;return{x:arc.center.x+arc.radius*Math.cos(angle),y:arc.center.y+arc.radius*Math.sin(angle)};}
export function edgeLength(g:Geometry,e:Edge){return e.kind==='line'?distance(...ends(g,e)):edgeArc(g,e).radius*Math.abs(edgeArc(g,e).delta);}
export function edgeCommand(g:Geometry,e:Edge){const [,b]=ends(g,e);if(e.kind==='line')return `L${b.x} ${b.y}`;const a=edgeArc(g,e);return `A${a.radius} ${a.radius} 0 ${Math.abs(a.delta)>Math.PI?1:0} ${a.delta>0?1:0} ${b.x} ${b.y}`;}
export function edgePath(g:Geometry,e:Edge){const [a]=ends(g,e);return `M${a.x} ${a.y} ${edgeCommand(g,e)}`;}
export function isClosed(g:Geometry){return g.edges.length>=2&&g.edges.every((e,i)=>e.to===g.edges[(i+1)%g.edges.length].from);}
export function contourPath(g:Geometry){return g.edges.map((e,i)=>`${i===0||g.edges[i-1].to!==e.from?`M${ends(g,e)[0].x} ${ends(g,e)[0].y}`:''} ${edgeCommand(g,e)}`).join(' ')+(isClosed(g)?' Z':'');}
export function bounds(g:Geometry){const ps:Point[]=[...g.points];for(const e of g.edges){if(e.kind==='arc')try{const arc=edgeArc(g,e);for(let i=0;i<4;i++){const p={x:arc.center.x+arc.radius*Math.cos(i*Math.PI/2),y:arc.center.y+arc.radius*Math.sin(i*Math.PI/2)};if(onArc(arc,p))ps.push(p);}}catch{/* Invalid draft arcs are reported by validation. */}}
 if(!ps.length)return{x:0,y:0,width:2400,height:1800};const x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y));return{x,y,width:Math.max(...ps.map(p=>p.x))-x,height:Math.max(...ps.map(p=>p.y))-y};}
export function signedArea(g:Geometry){return g.edges.reduce((n,e)=>{const[a,b]=ends(g,e);if(e.kind==='line')return n+cross(a,b)/2;const arc=edgeArc(g,e);return n+(arc.center.x*(b.y-a.y)-arc.center.y*(b.x-a.x)+arc.radius**2*arc.delta)/2;},0);}
export function projectLine(p:Point,a:Point,b:Point){const v=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),v)/(dot(v,v)||1)));return{x:a.x+t*v.x,y:a.y+t*v.y};}
export function projectEdge(g:Geometry,e:Edge,p:Point){const[a,b]=ends(g,e);if(e.kind==='line')return projectLine(p,a,b);const arc=edgeArc(g,e),d=distance(p,arc.center);const q={x:arc.center.x+(p.x-arc.center.x)*arc.radius/(d||1),y:arc.center.y+(p.y-arc.center.y)*arc.radius/(d||1)};return onArc(arc,q)?q:distance(p,a)<distance(p,b)?a:b;}
export function lineLine(a:Point,b:Point,c:Point,d:Point):{points:Point[];overlap:boolean}{const r=sub(b,a),s=sub(d,c),den=cross(r,s),q=sub(c,a);if(Math.abs(den)<EPS){if(Math.abs(cross(q,r))>EPS)return{points:[],overlap:false};const rr=dot(r,r);if(rr<EPS)return{points:[],overlap:false};const lo=Math.max(0,Math.min(dot(q,r)/rr,dot(sub(d,a),r)/rr)),hi=Math.min(1,Math.max(dot(q,r)/rr,dot(sub(d,a),r)/rr));return{points:hi>=lo-EPS?[{x:a.x+lo*r.x,y:a.y+lo*r.y}]:[],overlap:(hi-lo)*Math.sqrt(rr)>.001};}const t=cross(q,s)/den,u=cross(q,r)/den;return{points:t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?[{x:a.x+t*r.x,y:a.y+t*r.y}]:[],overlap:false};}
export function lineArc(a:Point,b:Point,arc:ReturnType<typeof arcThrough>){const v=sub(b,a),q=sub(a,arc.center),A=dot(v,v),B=2*dot(v,q),C=dot(q,q)-arc.radius**2,dis=B*B-4*A*C;if(A<EPS||dis<-EPS)return[];return [...new Set([(-B-Math.sqrt(Math.max(0,dis)))/(2*A),(-B+Math.sqrt(Math.max(0,dis)))/(2*A)])].filter(t=>t>=-EPS&&t<=1+EPS).map(t=>({x:a.x+t*v.x,y:a.y+t*v.y})).filter(p=>onArc(arc,p));}
export function intersections(g:Geometry,e:Edge,f:Edge){const[a,b]=ends(g,e),[c,d]=ends(g,f);if(e.kind==='line'&&f.kind==='line')return lineLine(a,b,c,d);if(e.kind==='line')return{points:lineArc(a,b,edgeArc(g,f)),overlap:false};if(f.kind==='line')return{points:lineArc(c,d,edgeArc(g,e)),overlap:false};
 const u=edgeArc(g,e),v=edgeArc(g,f),dist=distance(u.center,v.center);
 if(dist<EPS&&Math.abs(u.radius-v.radius)<EPS){const inside=(arc:typeof u,p:Point)=>onArc(arc,p)&&distance(p,a)>.001&&distance(p,b)>.001&&distance(p,c)>.001&&distance(p,d)>.001;return{points:[a,b,c,d].filter(p=>onArc(u,p)&&onArc(v,p)),overlap:inside(v,pointAt(g,e,.5))||inside(u,pointAt(g,f,.5))};}
 if(dist>u.radius+v.radius+EPS||dist<Math.abs(u.radius-v.radius)-EPS||dist<EPS)return{points:[],overlap:false};const along=(u.radius**2-v.radius**2+dist**2)/(2*dist),h=Math.sqrt(Math.max(0,u.radius**2-along**2)),dx=(v.center.x-u.center.x)/dist,dy=(v.center.y-u.center.y)/dist;return{points:[{x:u.center.x+along*dx-h*dy,y:u.center.y+along*dy+h*dx},{x:u.center.x+along*dx+h*dy,y:u.center.y+along*dy-h*dx}].filter(p=>onArc(u,p)&&onArc(v,p)),overlap:false};
}
export function pointInside(g:Geometry,p:Point){let winding=0;for(const e of g.edges){if(distance(p,projectEdge(g,e,p))<.001)return true;const[a,b]=ends(g,e);if(e.kind==='line'){if((a.y<=p.y&&b.y>p.y)||(b.y<=p.y&&a.y>p.y)){const x=a.x+(p.y-a.y)*(b.x-a.x)/(b.y-a.y);if(x>p.x)winding+=b.y>a.y?1:-1;}}else{const arc=edgeArc(g,e),s=(p.y-arc.center.y)/arc.radius;if(Math.abs(s)>=1)continue;for(const angle of [Math.asin(s),Math.PI-Math.asin(s)]){const q={x:arc.center.x+arc.radius*Math.cos(angle),y:p.y};if(q.x<=p.x||!onArc(arc,q))continue;const direction=Math.cos(angle)*Math.sign(arc.delta);if(distance(q,a)<.001&&direction<0||distance(q,b)<.001&&direction>0)continue;winding+=direction>0?1:-1;}}}return winding!==0;}
export function validBar(g:Geometry,bar:Bar,previous=g.bars.filter(b=>b.id!==bar.id)){if(distance(bar.a,bar.b)<1)return false;const supported=(p:Point)=>g.edges.some(e=>distance(p,projectEdge(g,e,p))<.01)||previous.some(b=>distance(p,projectLine(p,b.a,b.b))<.01);if(!supported(bar.a)||!supported(bar.b))return false;
 const ts=[0,1];for(const e of g.edges){const[a,b]=ends(g,e),hits=e.kind==='line'?lineLine(bar.a,bar.b,a,b).points:lineArc(bar.a,bar.b,edgeArc(g,e));for(const q of hits)ts.push(distance(bar.a,q)/distance(bar.a,bar.b));}ts.sort((a,b)=>a-b);return ts.every((t,i)=>!i||pointInside(g,{x:bar.a.x+(bar.b.x-bar.a.x)*(t+ts[i-1])/2,y:bar.a.y+(bar.b.y-bar.a.y)*(t+ts[i-1])/2}));}
export function validateGeometry(g:Geometry,requireClosed=true):string[]{
 const errors:string[]=[];if(!g.edges.length)return['Nacrtajte konturu ili izaberite početni oblik.'];
 if(g.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e6||Math.abs(p.y)>1e6))return['Tačke su izvan podržanog opsega.'];
 if(g.edges.some(e=>!g.points.some(p=>p.id===e.from)||!g.points.some(p=>p.id===e.to)))return['Kontura sadrži nepovezane segmente.'];
 try{
  for(const e of g.edges){if(edgeLength(g,e)<.01)errors.push('Segment mora imati pozitivnu dužinu.');if(e.locked&&(Math.abs(edgeLength(g,e)-e.locked.length)>.001||e.locked.radius!==undefined&&Math.abs(edgeArc(g,e).radius-e.locked.radius)>.001))errors.push(lockMessage);}
  const closed=isClosed(g);if(requireClosed&&!closed)errors.push('Kontura nije zatvorena. Spojite poslednju tačku sa početnom.');
  if(g.edges.some((e,i)=>i>0&&g.edges[i-1].to!==e.from)||g.points.some(p=>!g.edges.some(e=>e.from===p.id||e.to===p.id)))errors.push('Kontura sadrži nepovezane segmente.');
  for(let i=0;i<g.edges.length;i++)for(let j=i+1;j<g.edges.length;j++){const e=g.edges[i],f=g.edges[j],hit=intersections(g,e,f);const common=[e.from,e.to].filter(id=>id===f.from||id===f.to).map(id=>g.points.find(p=>p.id===id)!);if(hit.overlap||hit.points.some(p=>!common.some(q=>distance(p,q)<.001)))errors.push('Kontura se sama preseca ili dodiruje. Pomerite tačku ili obrišite segment.');}
  // Repeated visits to the same vertex are not a single simple contour.
  if(new Set(g.edges.map(e=>e.from)).size!==g.edges.length)errors.push('Kontura se vraća u istu tačku više puta.');
  if(closed&&Math.abs(signedArea(g))<1)errors.push('Oblik nema dovoljnu površinu.');
  if(g.bars.some((b,i)=>!validBar(g,b,g.bars.slice(0,i))))errors.push('Prečka izlazi iz oblika ili nije povezana. Obrišite prečke pre ove promene konture.');
 }catch(err){errors.push((err as Error).message);}
 return [...new Set(errors)];
}
export function resizeRectangle(g:Geometry,id:string,length:number,fixed:'from'|'to'='from'){
 const next=structuredClone(g),index=next.edges.findIndex(edge=>edge.id===id),edge=next.edges[index];
 if(!edge||edge.kind!=='line')throw Error('Izaberite stranicu pravougaonika.');
 const [a,b]=ends(next,edge),anchor=fixed==='from'?a:b;
 const frame=bounds(g),horizontal=index%2===0;
 const top=ends(g,g.edges[0]),width=horizontal?length:Math.abs(top[1].x-top[0].x),height=horizontal?frame.height:length;
 if(![width,height].every(value=>Number.isFinite(value)&&value>=200&&value<=20000))throw Error('Mere moraju biti između 200 i 20000 mm.');
 const corner=(index+(fixed==='to'?1:0))%4;
 const x=anchor.x-([1,2].includes(corner)?width:0),y=anchor.y-(corner>=2?height:0);
 for(const [i,side] of next.edges.entries()){
  const [point]=ends(next,side);
  point.x=x+([1,2].includes(i)?width:0);
  point.y=y+(i>=2?height:0);
 }
 for(const bar of next.bars)for(const point of [bar.a,bar.b]){
  point.x=x+(point.x-frame.x)*width/frame.width;
  point.y=y+(point.y-frame.y)*height/frame.height;
 }
 next.preset='rectangle';
 for(const previous of g.edges){
  if(previous.locked&&Math.abs(edgeLength(next,next.edges.find(side=>side.id===previous.id)!)-edgeLength(g,previous))>.001)
   throw Error('Otključajte stranicu čija mera mora da se promeni.');
 }
 const errors=validateGeometry(next);
 if(errors.length)throw Error(errors[0]);
 return next;
}

export function canRestoreRectangle(g:Geometry){
 return g.preset==='free'&&g.edges.length===4&&g.points.length===4&&g.edges.every((edge,i)=>
  edge.kind==='line'&&edge.id===`e${i}`&&edge.from===`p${i}`&&edge.to===`p${(i+1)%4}`);
}

function hasArchBase(g:Geometry){
 return g.edges.length===4&&g.points.length===4&&g.edges.every((edge,i)=>
  edge.id===`e${i}`&&edge.kind===(i===1?'arc':'line')&&edge.from===`p${i}`&&edge.to===`p${(i+1)%4}`);
}

export function isArchSide(g:Geometry,id:string){
 return (id==='e0'||id==='e2')&&hasArchBase(g);
}

export function isArchWidth(g:Geometry,id:string){
 return id==='e3'&&hasArchBase(g)||g.preset==='arch'&&id==='e1'&&g.edges.length===2&&g.edges[0].kind==='arc'&&isClosed(g);
}

export function hasLinkedArch(g:Geometry){
 if(g.preset==='arch')return true;
 if(g.preset!=='free'||!hasArchBase(g))return false;
 const [leftBottom,leftTop]=ends(g,g.edges[0]),[rightTop,rightBottom]=ends(g,g.edges[2]);
 const via=g.edges[1].via!;
 return Math.abs(leftBottom.x-leftTop.x)<EPS&&Math.abs(rightBottom.x-rightTop.x)<EPS&&
  Math.abs(leftTop.y-rightTop.y)<EPS&&Math.abs(leftBottom.y-rightBottom.y)<EPS&&
  Math.abs(via.x-(leftTop.x+rightTop.x)/2)<EPS&&via.y<leftTop.y&&leftTop.y-via.y<=(rightTop.x-leftTop.x)/2+EPS;
}

export function resizeArchWidth(g:Geometry,id:string,width:number,fixed:'from'|'to'){
 if(!isArchWidth(g,id)||!Number.isFinite(width)||width<200||width>20000)throw Error('Širina mora biti između 200 i 20000 mm.');
 const next=structuredClone(g);
 const arc=next.edges[next.edges.length===4?1:0],base=next.edges.at(-1)!;
 const [leftTop,rightTop]=ends(next,arc),[rightBottom,leftBottom]=ends(next,base);
 const anchor=fixed==='from'?rightBottom:leftBottom;
 const oldLeft=leftTop.x,oldWidth=rightTop.x-oldLeft;
 if(oldWidth<=0)throw Error('Luk mora imati pozitivnu širinu.');
 const spring=(leftTop.y+rightTop.y)/2;
 const bottom=anchor.y,left=fixed==='from'?anchor.x-width:anchor.x;
 const scale=width/oldWidth;
 const rise=hasLinkedArch(g)?(spring-arc.via!.y)*scale:width/2;
 leftBottom.x=leftTop.x=left;
 rightBottom.x=rightTop.x=left+width;
 leftTop.y=rightTop.y=spring;
 leftBottom.y=rightBottom.y=bottom;
 arc.via={x:left+width/2,y:spring-rise};
 for(const bar of next.bars)for(const point of [bar.a,bar.b]){
  point.x=left+(point.x-oldLeft)*scale;
  if(point.y<spring)point.y=spring+(point.y-spring)*scale;
 }
 next.preset='arch';
 const errors=validateGeometry(next);
 if(errors.length)throw Error(errors[0]);
 return next;
}

export function resizeArchSide(g:Geometry,id:string,length:number,fixed:'from'|'to'){
 if(!isArchSide(g,id)||!Number.isFinite(length)||length<=0||length>20000)throw Error('Dužina uspravne stranice luka mora biti veća od 0 i najviše 20000 mm.');
 const next=structuredClone(g);
 const [leftBottom,leftTop]=ends(next,next.edges[0]),[rightTop,rightBottom]=ends(next,next.edges[2]);
 const [a,b]=id==='e0'?[leftBottom,leftTop]:[rightTop,rightBottom];
 const anchor=fixed==='from'?a:b;
 const bottomFixed=anchor===leftBottom||anchor===rightBottom;
 const springY=bottomFixed?anchor.y-length:anchor.y, bottomY=springY+length;
 const oldSpring=(leftTop.y+rightTop.y)/2,oldBottom=(leftBottom.y+rightBottom.y)/2;
 if(oldBottom<=oldSpring)throw Error('Donje tačke moraju biti ispod luka.');
 const leftX=id==='e0'?anchor.x:leftTop.x,rightX=id==='e2'?anchor.x:rightTop.x;
 const radius=(rightX-leftX)/2;
 leftBottom.x=leftTop.x=leftX;
 rightBottom.x=rightTop.x=rightX;
 leftTop.y=rightTop.y=springY;
 leftBottom.y=rightBottom.y=bottomY;
 const rise=hasLinkedArch(g)?oldSpring-next.edges[1].via!.y:radius;
 next.edges[1].via={x:leftX+radius,y:springY-rise};
 for(const bar of next.bars)for(const point of [bar.a,bar.b]){
  point.y=springY+(point.y-oldSpring)*(point.y>oldSpring?length/(oldBottom-oldSpring):1);
 }
 next.preset='arch';
 const errors=validateGeometry(next);
 if(errors.length)throw Error(errors[0]);
 return next;
}

export function resizeLine(g:Geometry,id:string,length:number,fixed:'from'|'to'='from'){
 if(!Number.isFinite(length)||length<=0||length>20000)throw Error('Dužina mora biti veća od 0 i najviše 20000 mm.');
 if(g.preset==='rectangle'&&g.edges.length===4&&isClosed(g))return resizeRectangle(g,id,length,fixed);
 if(hasLinkedArch(g)&&isArchSide(g,id))return resizeArchSide(g,id,length,fixed);
 if(hasLinkedArch(g)&&isArchWidth(g,id))return resizeArchWidth(g,id,length,fixed);
 const next=structuredClone(g),edge=next.edges.find(e=>e.id===id);if(!edge||edge.kind!=='line')throw Error('Izaberite pravu liniju.');if(edge.locked)throw Error('Otključajte liniju pre promene mere.');const[a,b]=ends(next,edge),anchor=fixed==='from'?a:b,moving=fixed==='from'?b:a,v=sub(moving,anchor),old=distance(a,b);if(old<.01)throw Error('Početne tačke su iste. Pomerite čvor.');moving.x=anchor.x+v.x*length/old;moving.y=anchor.y+v.y*length/old;next.preset='free';const solved=solveLockedGeometry(g,next,[anchor.id],{id,length});const errors=validateGeometry(solved,isClosed(g));if(errors.length)throw Error(errors[0]);return solved;
}
export function resizeRadius(g:Geometry,id:string,radius:number){const next=structuredClone(g),e=next.edges.find(e=>e.id===id);if(!e||e.kind!=='arc')throw Error('Izaberite luk.');if(e.locked)throw Error('Otključajte luk pre promene radijusa.');const[a,b]=ends(next,e),chord=distance(a,b),old=edgeArc(next,e);if(!Number.isFinite(radius)||radius<chord/2||radius>20000)throw Error(`Radijus mora biti najmanje ${fmt(chord/2)} mm (polovina tetive), a najviše 20000 mm.`);const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},normal={x:-(b.y-a.y)/chord,y:(b.x-a.x)/chord},side=Math.sign(dot(sub(e.via!,mid),normal))||1,sag=radius+(Math.abs(old.delta)>Math.PI+1e-6?1:-1)*Math.sqrt(Math.max(0,radius**2-(chord/2)**2));e.via={x:mid.x+normal.x*sag*side,y:mid.y+normal.y*sag*side};next.preset=hasLinkedArch(g)?'arch':'free';const errors=validateGeometry(next,isClosed(g));if(errors.length)throw Error(errors[0]);return next;}
export function presetGeometry(shape:Exclude<Shape,'free'>,width=2400,height=1600):Geometry{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<200||height<200||width>20000||height>20000)throw Error('Mere moraju biti između 200 i 20000 mm.');
 if(shape==='arch'&&height<width/2)throw Error('Visina polukružnog prozora mora biti najmanje polovina širine.');
 const coords:Point[]=shape==='rectangle'?[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}]:shape==='triangle'?[{x:0,y:height},{x:0,y:0},{x:width,y:height}]:shape==='trapezoid'?[{x:0,y:height},{x:0,y:height*.25},{x:width,y:0},{x:width,y:height}]:shape==='polygon'?[{x:0,y:height},{x:0,y:height*.4},{x:width/2,y:0},{x:width,y:height*.4},{x:width,y:height}]:shape==='arch'?[{x:0,y:height},{x:0,y:width/2},{x:width,y:width/2},{x:width,y:height}]:[{x:0,y:width/2},{x:width,y:width/2}];
 // A zero-height rectangular base is represented by one semicircle and its diameter.
 if(shape==='arch'&&Math.abs(height-width/2)<EPS){coords.splice(0,coords.length,{x:0,y:height},{x:width,y:height});}
 const points=coords.map((p,i)=>({...p,id:`p${i}`})),edges:Edge[]=points.map((p,i)=>({id:`e${i}`,from:p.id,to:points[(i+1)%points.length].id,kind:'line'}));
 if(shape==='arch'){const idx=edges.length===2?0:1;edges[idx]={...edges[idx],kind:'arc',via:{x:width/2,y:0}};}
 if(shape==='circle'){edges[0]={...edges[0],kind:'arc',via:{x:width/2,y:0}};edges[1]={...edges[1],kind:'arc',via:{x:width/2,y:width}};}
 return{version:1,points,edges,bars:[],preset:shape};
}
export function isGeometry(value:unknown):value is Geometry{
 const g=value as Geometry;if(!g||g.version!==1||!Array.isArray(g.points)||!Array.isArray(g.edges)||!Array.isArray(g.bars)||g.points.length>256||g.edges.length>256||g.bars.length>100||!['free','rectangle','triangle','trapezoid','arch','circle','polygon'].includes(g.preset))return false;
 if(g.openings!==undefined&&(!Array.isArray(g.openings)||g.openings.length>256||!g.openings.every(mark=>mark&&typeof mark.region==='string'&&mark.region.length<=80000&&(mark.side==='left'||mark.side==='right'))||new Set(g.openings.map(mark=>mark.region)).size!==g.openings.length))return false;
 const point=(p:Point)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1e6&&Math.abs(p.y)<=1e6,id=(s:string)=>typeof s==='string'&&s.length>0&&s.length<=100;
 return g.points.every(p=>point(p)&&id(p.id))&&new Set(g.points.map(p=>p.id)).size===g.points.length&&g.edges.every(e=>id(e.id)&&['line','arc'].includes(e.kind)&&g.points.some(p=>p.id===e.from)&&g.points.some(p=>p.id===e.to)&&(e.kind!=='arc'||point(e.via!))&&(e.locked===undefined||typeof e.locked==='object'&&e.locked!==null&&Number.isFinite(e.locked.length)&&e.locked.length>0&&e.locked.length<=1e8&&(e.locked.radius===undefined||e.kind==='arc'&&Number.isFinite(e.locked.radius)&&e.locked.radius>0&&e.locked.radius<=1e7)))&&new Set(g.edges.map(e=>e.id)).size===g.edges.length&&g.bars.every(b=>id(b.id)&&point(b.a)&&point(b.b))&&new Set(g.bars.map(b=>b.id)).size===g.bars.length;
}

export const lockMessage='Zaključane mere ne dozvoljavaju ovu izmenu. Otključajte povezanu liniju.';
export function toggleEdgeLock(g:Geometry,id:string){
 const next=structuredClone(g),e=next.edges.find(e=>e.id===id);if(!e)throw Error('Izaberite liniju ili luk.');
 if(e.locked)delete e.locked;else e.locked={length:edgeLength(next,e),...(e.kind==='arc'?{radius:edgeArc(next,e).radius}:{})};return next;
}
/** Distance constraints preserve millimetres, not rounded screen labels. Pinned vertices are explicit user anchors. */
export function solveLockedGeometry(before:Geometry,desired:Geometry,pinned:string[]=[],target?:{id:string;length:number}):Geometry{
 const locks=before.edges.filter(e=>e.locked);if(!locks.length)return desired;
 const next=structuredClone(desired),pins=new Set(pinned),constraints:{from:string;to:string;length:number}[]=[];
 for(const old of locks){const edge=next.edges.find(e=>e.id===old.id);if(!edge||edge.from!==old.from||edge.to!==old.to||!next.points.some(p=>p.id===edge.from)||!next.points.some(p=>p.id===edge.to))throw Error(lockMessage);edge.locked=structuredClone(old.locked);constraints.push({from:edge.from,to:edge.to,length:old.kind==='line'?old.locked!.length:distance(...ends(before,old))});}
 if(target){const e=next.edges.find(e=>e.id===target.id)!;constraints.push({from:e.from,to:e.to,length:target.length});}
 const vertices=new Map(next.points.map(p=>[p.id,p]));let converged=false;
 for(let pass=0;pass<1000;pass++){
  for(const c of constraints){const a=vertices.get(c.from)!,b=vertices.get(c.to)!,v=sub(b,a),len=distance(a,b);if(len<1e-8)throw Error(lockMessage);const wa=pins.has(a.id)?0:1,wb=pins.has(b.id)?0:1;if(!wa&&!wb)continue;const delta=(len-c.length)/(wa+wb);if(wa){a.x+=v.x/len*delta;a.y+=v.y/len*delta;}if(wb){b.x-=v.x/len*delta;b.y-=v.y/len*delta;}}
  if(constraints.every(c=>Math.abs(distance(vertices.get(c.from)!,vertices.get(c.to)!)-c.length)<.00001)){converged=true;break;}
 }
 if(!converged)throw Error(lockMessage);
 // A locked circular arc preserves both radius and arc length; regenerate its midpoint after its endpoints move.
 for(const old of locks.filter(e=>e.kind==='arc')){const e=next.edges.find(e=>e.id===old.id)!,[a,b]=ends(next,e),arc=edgeArc(before,old),chord=distance(a,b),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},[oa,ob]=ends(before,old),om={x:(oa.x+ob.x)/2,y:(oa.y+ob.y)/2},ov=pointAt(before,old,.5),side=Math.sign(cross(sub(ob,oa),sub(ov,om)))||1,sag=arc.radius+(Math.abs(arc.delta)>Math.PI+1e-6?1:-1)*Math.sqrt(Math.max(0,arc.radius**2-(chord/2)**2));e.via={x:mid.x-(b.y-a.y)/chord*sag*side,y:mid.y+(b.x-a.x)/chord*sag*side};}
 for(const e of next.edges.filter(e=>e.locked)){if(Math.abs(edgeLength(next,e)-e.locked!.length)>.001||e.locked!.radius!==undefined&&Math.abs(edgeArc(next,e).radius-e.locked!.radius!)>.001)throw Error(lockMessage);}
 return next;
}
export function moveArcControl(g:Geometry,id:string,q:Point){
 const next=structuredClone(g),e=next.edges.find(e=>e.id===id);if(!e||e.kind!=='arc')throw Error('Izaberite luk.');if(e.locked)throw Error('Otključajte luk da biste promenili zakrivljenost.');
 const[a,b]=ends(next,e),chord=distance(a,b),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},normal={x:-(b.y-a.y)/chord,y:(b.x-a.x)/chord},sag=dot(sub(q,mid),normal);
 if(Math.abs(sag)<1)throw Error('Pomerite žuti čvor dalje od tetive luka.');
 e.via={x:mid.x+normal.x*sag,y:mid.y+normal.y*sag};arcThrough(a,b,e.via);next.preset=hasLinkedArch(g)&&e.via.y<mid.y&&Math.abs(sag)<=chord/2?'arch':'free';return next;
}

/** Align a segment exactly to an axis. Both endpoints are pinned during constraint solving. */
export function alignLine(g:Geometry,id:string,axis:'horizontal'|'vertical',fixed:'from'|'to'='from'){
 const next=structuredClone(g),e=next.edges.find(e=>e.id===id);if(!e||e.kind!=='line')throw Error('Poravnanje je dostupno samo za pravu liniju.');
 const[a,b]=ends(next,e),anchor=fixed==='from'?a:b,moving=fixed==='from'?b:a,length=distance(a,b);if(length<.01)throw Error('Linija mora imati dva različita kraja.');
 if(axis==='horizontal'){const direction=moving.x<anchor.x?-1:1;moving.x=anchor.x+direction*length;moving.y=anchor.y;}
 else{const direction=moving.y<anchor.y?-1:1;moving.x=anchor.x;moving.y=anchor.y+direction*length;}
 next.preset='free';const solved=solveLockedGeometry(g,next,[a.id,b.id]);
 // Explicit pins ensure a constraint solver cannot introduce a small slope.
 const[sa,sb]=ends(solved,solved.edges.find(edge=>edge.id===id)!);if(axis==='horizontal'?sa.y!==sb.y:sa.x!==sb.x)throw Error(lockMessage);
 const errors=validateGeometry(solved,isClosed(g));if(errors.length)throw Error(errors[0]);return solved;
}
