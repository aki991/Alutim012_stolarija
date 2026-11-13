import type { Geometry, Point, Shape } from './custom/geometry';
import { bounds, presetGeometry } from './custom/geometry';
import { openingRegions, type HingeSide } from './custom/openings';
import { divideWindow } from './custom/windowLayout';
import type { Category, Position } from './models';
import type { Infill, ModelLayout, ModelRow, Movement } from './model-layout';

export const modelGroups = {
 windows: 'Prozori', doors: 'Vrata', sliding: 'Klizni sistemi', folding: 'Sklopivi sistemi',
 shapes: 'Posebni oblici', roof: 'Krovni prozori', facade: 'Portali i fasade',
 automatic: 'Automatska vrata', garage: 'Garažna i industrijska vrata',
} as const;
type Group = keyof typeof modelGroups;
type ShapeVariant = Exclude<Shape,'free'>|'arch-top'|'segment'|'quarter'|'ellipse'|'iso-triangle'|'mirror-triangle'|'mirror-trapezoid'|'parallelogram'|'diamond'|'hexagon'|'octagon'|'gothic';
type ShapeModel = {variant:ShapeVariant; split?:'fixed'|HingeSide; hinge?:HingeSide};
interface ModelBase { id:string; name:string; group:Group; category:Category; width:number; height:number; material:Position['material']; keywords?:string }
export type CatalogModel = ModelBase & ({layout:ModelLayout; shape?:never}|{shape:ShapeModel; layout?:never});

const models: CatalogModel[]=[];
const windowCategory:Category='Prozori';
const doorCategory:Category='Vrata';
const slidingCategory:Category='Klizni sistemi';
const entranceCategory:Category='Ulazna vrata';
const row=(moves:Movement[],weight:number, infill:Infill='glass',weights?:number[]):ModelRow=>({weight,cells:moves.map((movement,i)=>({movement,infill,weight:weights?.[i]??1}))});
const fixed='fixed' as const;
const fill=(count:number,move:Movement)=>Array.from({length:count},()=>move);

function addModel(group:Group,category:Category,system:string,id:string,variant:string,width:number,height:number,rows:ModelRow[],options:{material?:Position['material'];keywords?:string;cornerAfter?:number}={}) {
 models.push({group,category,name:variant?`${system} · ${variant}`:system,id,width,height,material:options.material??'ALU',keywords:options.keywords,layout:{system,rows,cornerAfter:options.cornerAfter}});
}

const surrounds = [
 {id:'plain', label:'', left:false, right:false, top:false, bottom:false},
 {id:'top', label:'nadsvetlo', left:false, right:false, top:true, bottom:false},
 {id:'bottom', label:'donje fiksno polje', left:false, right:false, top:false, bottom:true},
 {id:'left', label:'fiksno levo', left:true, right:false, top:false, bottom:false},
 {id:'right', label:'fiksno desno', left:false, right:true, top:false, bottom:false},
 {id:'sides', label:'bočna fiksna polja', left:true, right:true, top:false, bottom:false},
 {id:'top-left', label:'nadsvetlo i fiksno levo', left:true, right:false, top:true, bottom:false},
 {id:'top-right', label:'nadsvetlo i fiksno desno', left:false, right:true, top:true, bottom:false},
 {id:'top-sides', label:'nadsvetlo i bočna polja', left:true, right:true, top:true, bottom:false},
 {id:'top-bottom', label:'gornje i donje fiksno polje', left:false, right:false, top:true, bottom:true},
] as const;

const windowTypes: {id:string;name:string;pair:[Movement,Movement];keywords:string;alu?:boolean}[]=[
 {id:'turn',name:'Zaokretni prozor ka unutra',pair:['left','right'],keywords:'obrtni'},
 {id:'turn-tilt',name:'Zaokretno-otklopni prozor',pair:['tiltLeft','tiltRight'],keywords:'kip nagib nagibno zaokretni tilt turn'},
 {id:'turn-out',name:'Zaokretni prozor ka spolja',pair:['outLeft','outRight'],keywords:'bočne šarke casement'},
 {id:'tilt',name:'Kip prozor',pair:['tilt','tilt'],keywords:'otklopni hopper donje šarke'},
 {id:'awning',name:'Prozor sa gornjim šarkama',pair:['awning','awning'],keywords:'tenda awning gornje vešanje'},
 {id:'projected',name:'Izbačajni prozor',pair:['projected','projected'],keywords:'projektujući projected top hung',alu:true},
 {id:'parallel',name:'Paralelno izbačajni prozor',pair:['parallel','parallel'],keywords:'paralelno izbacivanje parallel opening',alu:true},
 {id:'pivot-h',name:'Horizontalni pivot prozor',pair:['pivotH','pivotH'],keywords:'obrtni oko horizontalne ose',alu:true},
 {id:'pivot-v',name:'Vertikalni pivot prozor',pair:['pivotV','pivotV'],keywords:'obrtni oko vertikalne ose',alu:true},
 {id:'louvre',name:'Lamelski prozor',pair:['louvre','louvre'],keywords:'žaluzina louvre jalousie ventilacija',alu:true},
];

for(const type of windowTypes){
 const [left,right]=type.pair;
 for(const surround of surrounds){
  const countLimit=surround.id==='plain'||surround.id==='top'||surround.id==='bottom'?4:2;
  for(let count=1;count<=countLimit;count++){
   // Fixed fields at the sides already belong to the surround. For the plain, top,
   // and bottom models, include the common combinations with fixed central fields.
   const patterns=[fill(count,left)];
   if(right!==left)patterns.push(fill(count,right));
   if(count>=2&&right!==left)patterns.push([left,...fill(count-2,fixed),right],[right,...fill(count-2,fixed),left]);
   if(count>=3&&right!==left)patterns.push(Array.from({length:count},(_,i)=>i%2?right:left),Array.from({length:count},(_,i)=>i%2?left:right));
   if(countLimit===4&&count>=2){
    for(let active=0;active<count;active++){
     for(const movement of new Set(type.pair))patterns.push(Array.from({length:count},(_,i)=>i===active?movement:fixed));
    }
    if(count>=3)patterns.push([left,...fill(count-2,fixed),right],[fixed,...fill(count-2,left),fixed]);
   }
   const seen=new Set<string>();
   for(const pattern of patterns){
    const key=pattern.join('-');
    if(seen.has(key))continue;
    seen.add(key);
    const center:Movement[]=[...(surround.left?[fixed]:[]),...pattern,...(surround.right?[fixed]:[])];
    const rows=[row(center,1200,'glass',center.map((_,i)=>surround.left&&i===0||surround.right&&i===center.length-1?420:800))];
    if(type.id==='louvre')rows[0].cells=rows[0].cells.map(cell=>cell.movement==='louvre'?{...cell,infill:'slats'}:cell);
    if(surround.top)rows.unshift(row([fixed],300));
    if(surround.bottom)rows.push(row([fixed],350));
    const leaf=(move:Movement)=>move==='fixed'?'fiksno':move===left&&right!==left?'šarke L':move===right&&right!==left?'šarke D':'otvaranje';
    const variant=[pattern.map(leaf).join(' / '),surround.label].filter(Boolean).join(', ');
    addModel('windows',windowCategory,type.name,`w-${type.id}-${surround.id}_${key}`,variant,800*count+420*(Number(surround.left)+Number(surround.right)),rows.reduce((n,r)=>n+r.weight,0),rows,{material:type.alu?'ALU':'PVC',keywords:type.keywords});
   }
  }
 }
}

for(let columns=1;columns<=6;columns++)for(let levels=1;levels<=4;levels++){
 addModel('windows',windowCategory,'Fiksno zastakljenje',`w-fixed-${columns}-${levels}`,columns===1&&levels===1?'':`${columns} × ${levels} polja`,columns*750,levels*700,Array.from({length:levels},()=>row(fill(columns,fixed),1)),{material:'PVC',keywords:'fiksni izlog prečke staklena stena'});
}
for(const surround of surrounds)for(const primary of ['left','right'] as const){
 const moves:Movement[]=primary==='left'?['tiltLeft','right']:['left','tiltRight'];
 if(surround.left)moves.unshift(fixed);
 if(surround.right)moves.push(fixed);
 const rows=[row(moves,1200)];
 if(surround.top)rows.unshift(row([fixed],300));
 if(surround.bottom)rows.push(row([fixed],350));
 addModel('windows',windowCategory,'Dvokrilni prozor sa jednim kip krilom',`w-mixed-${surround.id}-${primary}`,[`kip ${primary==='left'?'levo':'desno'}`,surround.label].filter(Boolean).join(', '),moves.length*730,rows.reduce((n,r)=>n+r.weight,0),rows,{material:'PVC',keywords:'zaokretni i zaokretno otklopni mešovito'});
}

const doorTypes: {id:string;name:string;category:Category;infill:Infill;pair:[Movement,Movement];single?:boolean;keywords?:string}[]=[
 {id:'entrance-panel',name:'Ulazna vrata sa punim panelom',category:entranceCategory,infill:'panel',pair:['left','right']},
 {id:'entrance-glass',name:'Zastakljena ulazna vrata',category:entranceCategory,infill:'glass',pair:['left','right']},
 {id:'entrance-combined',name:'Ulazna vrata sa staklom i panelom',category:entranceCategory,infill:'glassPanel',pair:['left','right']},
 {id:'entrance-out',name:'Ulazna vrata ka spolja',category:entranceCategory,infill:'glass',pair:['outLeft','outRight']},
 {id:'interior-panel',name:'Puna sobna vrata',category:doorCategory,infill:'panel',pair:['left','right']},
 {id:'interior-glass',name:'Staklena sobna vrata',category:doorCategory,infill:'glass',pair:['left','right']},
 {id:'balcony',name:'Balkonska vrata',category:doorCategory,infill:'glass',pair:['left','right'],keywords:'terasa francuski prozor francuska vrata'},
 {id:'balcony-panel',name:'Balkonska vrata sa donjim panelom',category:doorCategory,infill:'glassPanel',pair:['left','right']},
 {id:'balcony-tilt',name:'Balkonska vrata sa kipom',category:doorCategory,infill:'glass',pair:['tiltLeft','tiltRight'],keywords:'terasa zaokretno otklopno'},
 {id:'balcony-out',name:'Balkonska vrata ka spolja',category:doorCategory,infill:'glass',pair:['outLeft','outRight'],keywords:'terasa francuski prozor'},
 {id:'pivot',name:'Pivot vrata',category:entranceCategory,infill:'panel',pair:['pivotV','pivotV'],single:true,keywords:'centralna ili pomerena osa'},
 {id:'pivot-glass',name:'Zastakljena pivot vrata',category:entranceCategory,infill:'glass',pair:['pivotV','pivotV'],single:true},
 {id:'pivot-offset',name:'Pivot vrata sa pomerenom osom',category:entranceCategory,infill:'glass',pair:['pivotVLeft','pivotVRight'],single:true},
 {id:'swing-both',name:'Klatna vrata u oba smera',category:doorCategory,infill:'glass',pair:['doubleLeft','doubleRight'],keywords:'saloon dvostrano njihajuća'},
 {id:'escape',name:'Vrata sa antipanik otvaranjem',category:entranceCategory,infill:'glass',pair:['outLeft','outRight'],keywords:'evakuaciona izlaz sigurnosna panik letva'},
 {id:'fire',name:'Protivpožarna vrata',category:entranceCategory,infill:'panel',pair:['outLeft','outRight'],keywords:'požar dim EI vatrootporna'},
 {id:'security',name:'Protivprovalna vrata',category:entranceCategory,infill:'panel',pair:['left','right'],keywords:'sigurnosna blindirana'},
];
for(const type of doorTypes){
 const [left,right]=type.pair;
 const offset=type.id==='pivot-offset';
 const leaves:{id:string;label:string;moves:Movement[];widths:number[]}[]=[{id:'l',label:left===right?'jedno krilo':offset?'osa ulevo':'šarke levo',moves:[left],widths:[1000]}];
 if(right!==left)leaves.push({id:'r',label:offset?'osa udesno':'šarke desno',moves:[right],widths:[1000]});
 if(!type.single)leaves.push(
  {id:'double',label:'dva jednaka krila',moves:[left,right],widths:[850,850]},
  {id:'double-l',label:'šire krilo levo',moves:[left,right],widths:[950,450]},
  {id:'double-r',label:'šire krilo desno',moves:[left,right],widths:[450,950]},
 );
 for(const surround of surrounds.filter(s=>!s.bottom))for(const leaf of leaves){
  const middle=row(leaf.moves,2100,type.infill,leaf.widths);
  if(surround.left)middle.cells.unshift({movement:fixed,infill:'glass',weight:430});
  if(surround.right)middle.cells.push({movement:fixed,infill:'glass',weight:430});
  const rows=surround.top?[row([fixed],350),middle]:[middle];
  addModel('doors',type.category,type.name,`d-${type.id}-${surround.id}-${leaf.id}`,[leaf.label,surround.label].filter(Boolean).join(', '),middle.cells.reduce((n,c)=>n+c.weight,0),surround.top?2450:2100,rows,{material:type.id.startsWith('balcony')?'PVC':'ALU',keywords:type.keywords});
 }
}

const slidingPatterns: [string,Movement[]][]=[
 ['klizno + fiksno',['slideRight',fixed]], ['fiksno + klizno',[fixed,'slideLeft']],
 ['dva pokretna krila',['slideRight','slideLeft']],
 ['dva pokretna ulevo',[fixed,'slideLeft','slideLeft']], ['dva pokretna udesno',['slideRight','slideRight',fixed]],
 ['pokretno između fiksnih, ulevo',[fixed,'slideLeft',fixed]], ['pokretno između fiksnih, udesno',[fixed,'slideRight',fixed]],
 ['bočna klizna + fiksno u sredini',['slideRight',fixed,'slideLeft']],
 ['tri pokretna, slaganje ulevo',['slideLeft','slideLeft','slideLeft']], ['tri pokretna, slaganje udesno',['slideRight','slideRight','slideRight']],
 ['otvaranje od sredine',[fixed,'slideLeft','slideRight',fixed]], ['spoljna pokretna krila',['slideRight',fixed,fixed,'slideLeft']],
 ['četiri pokretna, otvaranje od sredine',['slideLeft','slideLeft','slideRight','slideRight']],
 ['četiri pokretna, slaganje ulevo',fill(4,'slideLeft')], ['četiri pokretna, slaganje udesno',fill(4,'slideRight')],
 ['pet pokretnih, slaganje ulevo',fill(5,'slideLeft')], ['pet pokretnih, slaganje udesno',fill(5,'slideRight')],
 ['šest pokretnih, otvaranje od sredine',[...fill(3,'slideLeft'),...fill(3,'slideRight')]],
];
const slidingTypes:[string,string,number[],string,boolean][]=[
 ['slide','Paralelno klizni',slidingPatterns.map((_,i)=>i),'klasično klizanje dvokanalni trokanalni',false],
 ['hs','Podizno-klizni',[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,17],'HS HST lift slide',true],
 ['psk','Otklopno-klizni',[0,1,5,6,10],'PSK kip tilt and slide',false],
 ['ps','Odmično-klizni',[0,1,5,6,10],'PS PAS smart slide paralelno odmični',false],
 ['minimal','Panoramski klizni',[0,1,3,4,8,9,10,12,13,14,15,16,17],'minimalni uski profil minimal sliding',true],
 ['monorail','Jednošinski klizni',[0,1,5,6,10],'monorail jednokanalni jedna šina',true],
 ['curved','Lučni klizni',[0,1,10],'zakrivljen u osnovi curved',true],
];
for(const [id,title,patterns,keywords,alu] of slidingTypes)for(const isDoor of [false,true]){
 const system=`${title} ${isDoor?'sistem za vrata':'prozor'}`;
 for(const index of patterns){
  const [label,moves]=slidingPatterns[index];
  for(const top of [false,true]){
   const height=isDoor?2250:1250;
   const rows=[row(moves,height)];
   if(top)rows.unshift(row([fixed],350));
   addModel('sliding',isDoor?slidingCategory:windowCategory,system,`s-${id}-${isDoor?'d':'w'}-${moves.join('-')}${top?'-top':''}`,`${label}${top?', nadsvetlo':''}`,moves.length*(isDoor?950:700),height+(top?350:0),rows,{material:alu?'ALU':'PVC',keywords});
  }
 }
}

for(const [id,label,counts] of [['pocket','Klizanje u zidni džep',[1,2,3,4]],['hs-pocket','Podizno-klizni sistem u zidni džep',[1,2,3,4]],['wall','Klizanje uz zid',[1,2]],['stack','Klizno-okretni sistem',[2,3,4,5,6,7,8]],['telescopic','Teleskopski klizni sistem',[2,3,4,5,6]]] as const){
 for(const count of counts)for(const direction of ['slideLeft','slideRight','split'] as const){
  if(direction==='split'&&count%2)continue;
  const moves=direction==='split'?[...fill(count/2,'slideLeft'),...fill(count/2,'slideRight')]:fill(count,direction);
  for(const isDoor of [false,true])addModel('sliding',isDoor?slidingCategory:windowCategory,`${label} za ${isDoor?'vrata':'prozor'}`,`s-${id}-${isDoor?'d':'w'}-${count}-${direction}`,`${count} ${count===1?'krilo':'krila'}, ${direction==='split'?'na obe strane':direction==='slideLeft'?'ulevo':'udesno'}`,count*(isDoor?850:650),isDoor?2200:1100,[row(moves,1)],{keywords:'pocket kasa zid skriveno višekanalno slide turn stack'});
 }
}
for(const [id,system] of [['slide','Klizni ugao'],['hs','Podizno-klizni ugao'],['minimal','Panoramski klizni ugao']] as const){
 for(let left=2;left<=4;left++)for(let right=2;right<=4;right++){
  const moves:Movement[]=[fixed,...fill(left-1,'slideLeft'),...fill(right-1,'slideRight'),fixed];
  addModel('sliding',slidingCategory,system,`s-corner-${id}-${left}-${right}`,`${left} + ${right} polja`,(left+right)*900,2300,[row(moves,1)],{cornerAfter:left,keywords:'bez stuba 90 stepeni otvoreni ugao'});
 }
}

for(const [id,system,patterns] of [
 ['hung','Vertikalno klizni prozor',[['fixed','slideUp'],['slideDown','fixed'],['slideDown','slideUp']]],
 ['guillotine','Giljotina prozor',[['fixed','slideUp'],['slideDown','fixed'],['slideDown','slideUp'],['fixed','slideUp','slideUp'],['slideDown','slideDown','fixed'],['slideDown','fixed','slideUp']]],
 ['guillotine-motor','Motorna giljotina',[['fixed','slideUp'],['slideDown','fixed'],['slideDown','slideUp'],['fixed','slideUp','slideUp'],['slideDown','slideDown','fixed']]],
] satisfies [string,string,Movement[][]][]){
 for(const moves of patterns)addModel('sliding',windowCategory,system,`s-${id}-${moves.join('-')}`,moves.map(move=>move===fixed?'fiksno':move==='slideUp'?'nagore':'nadole').join(' / '),1200,moves.length*620,moves.map(move=>row([move],1)),{keywords:'single hung double hung sash vertikalni klizni prozor'});
}

for(const isDoor of [true,false])for(const outward of [false,true]){
 const system=`Sklopiv${isDoor?'a vrata':'i prozor'} ka ${outward?'spolja':'unutra'}`;
 const limit=isDoor?22:8;
 for(let count=2;count<=limit;count++)for(let left=0;left<=count;left++){
  const right=count-left;
  if(count>12&&Math.max(left,right)>12)continue;
  const moves=[...fill(left,'foldLeft'),...fill(right,'foldRight')];
  addModel('folding',isDoor?slidingCategory:windowCategory,system,`f-${isDoor?'d':'w'}-${outward?'out':'in'}-${left}-${right}`,`${left} levo + ${right} desno`,count*(isDoor?780:570),isDoor?2250:1120,[row(moves,1)],{keywords:'harmonika falt faltajuća preklopna bifold'});
 }
}

for(const [id,system,move] of [
 ['fixed','Fiksni krovni prozor','fixed'],['pivot','Krovni prozor sa središnjom osom','pivotH'],
 ['top','Krovni prozor sa gornjim šarkama','awning'],['dual','Krovni prozor sa gornjom i središnjom osom','projected'],
 ['raised','Krovni prozor sa povišenom osom','pivotH'],['escape','Krovni izlaz','outRight'],
 ['flat-fixed','Fiksni prozor za ravan krov','fixed'],['flat-vent','Otvarajući prozor za ravan krov','awning'],
 ['smoke','Krovni prozor za odimljavanje','awning'],['dome','Svetlosna kupola','fixed'],
] satisfies [string,string,Movement][]){
 for(let count=1;count<=(['escape','smoke','dome'].includes(id)?1:4);count++)addModel('roof',windowCategory,system,`r-${id}-${count}`,count===1?'':`${count} spojena polja`,count*800,1200,[row(fill(count,move),1)],{keywords:'svetlarnik krovni svetlarnik skylight Velux Fakro'});
}
addModel('roof',windowCategory,'Krovni prozor koji se otvara u balkon','r-balcony','',950,2450,[row(['awning'],1300),row(['outBottom'],1150)],{keywords:'krovni balkon Cabrio'});
addModel('roof',windowCategory,'Krovni prozor sa fiksnim produžetkom','r-extension','',950,2100,[row(['pivotH'],1300),row([fixed],800)],{keywords:'vertikalni dodatak'});

for(let columns=2;columns<=8;columns++)for(let levels=2;levels<=4;levels++){
 const rows=Array.from({length:levels},()=>row(fill(columns,fixed),1));
 addModel('facade',windowCategory,'Staklena fasada',`facade-${columns}-${levels}`,`${columns} × ${levels} polja`,columns*1000,levels*1100,rows,{keywords:'zid zavesa curtain wall strukturalna polustrukturalna fasada'});
 for(const [id,move,label] of [['awning','awning','gornje otvaranje'],['parallel','parallel','paralelno izbačajno polje']] as const){
  const openingRows=structuredClone(rows);
  openingRows[0].cells[Math.floor(columns/2)].movement=move;
  addModel('facade',windowCategory,'Staklena fasada',`facade-${id}-${columns}-${levels}`,`${columns} × ${levels}, ${label}`,columns*1000,levels*1100,openingRows,{keywords:'izlog fasadni zid'});
 }
}
for(const [id,system,move] of [['bay','Erker sa bočnim fiksnim poljima','fixed'],['bay-turn','Erker sa bočnim otvaranjem','tiltLeft'],['bay-bow','Poligonalni erker','fixed']] as const){
 for(const count of id==='bay-bow'?[4,5,6]:[3])addModel('facade',windowCategory,system,`bay-${id}-${count}`,`${count} polja u razvijenom pogledu`,count*650,1350,[row([move,...fill(count-2,fixed),move==='fixed'?fixed:'tiltRight'],1)],{keywords:'bay bow oriel ugaoni prozor'});
}
for(const [id,name,move] of [['left','Portal sa jednokrilnim vratima','left'],['right','Portal sa jednokrilnim vratima','right'],['pivot','Portal sa pivot vratima','pivotV']] as const){
 for(let left=0;left<=3;left++)for(let right=0;right<=3;right++){
  if(left+right<2)continue;
  const moves=[...fill(left,fixed),move,...fill(right,fixed)];
  addModel('facade',entranceCategory,name,`portal-${id}-${left}-${right}`,`${left} fiksno L / ${right} fiksno D${id==='left'?', šarke L':id==='right'?', šarke D':''}`,moves.length*850,2650,[row(fill(moves.length,fixed),500),row(moves,2150)],{keywords:'izlog ulaz nadsvetlo portal'});
 }
}

for(const [id,system,move] of [
 ['slide','Automatska klizna vrata','slideLeft'],['tel','Automatska teleskopska vrata','slideLeft'],['curve','Automatska lučna klizna vrata','slideLeft'],
 ['swing','Automatska zaokretna vrata','left'],['fold','Automatska sklopiva vrata','foldLeft'],['breakout','Automatska klizna vrata sa funkcijom izlaza','slideLeft'],
] as const){
 const right:Movement=move==='left'?'right':move==='foldLeft'?'foldRight':'slideRight';
 const layouts:Movement[][]=id==='tel'?[[fixed,move,move],[right,right,fixed],[fixed,move,move,right,right,fixed]]:id==='fold'?[[move,move],[right,right],[move,move,right,right]]:[[fixed,move],[right,fixed],[fixed,move,right,fixed]];
 for(const moves of layouts)for(const top of [false,true])addModel('automatic',entranceCategory,system,`a-${id}-${moves.join('-')}${top?'-top':''}`,`${moves.filter(m=>m!==fixed).length} pokretna polja, ${moves.includes(move)&&moves.includes(right)?'obostrano':moves.includes(move)?'ulevo':'udesno'}${top?', nadsvetlo':''}`,moves.length*750,top?2550:2200,top?[row([fixed],350),row(moves,2200)]:[row(moves,1)],{keywords:'senzorska motorna fotoćelija poslovni ulaz'});
}
for(const count of [2,3,4])addModel('automatic',entranceCategory,'Rotirajuća ulazna vrata',`a-revolving-${count}`,`${count} krila`,2800,2350,[row(fill(count,'revolve'),1)],{keywords:'karusel revolving obrtna vrata'});

for(const [id,system,move] of [
 ['sectional','Segmentna garažna vrata','sectional'],['roll','Rolo garažna vrata','roll'],['canopy','Podizno-zakretna garažna vrata','canopy'],
 ['side-left','Bočno klizna segmentna garažna vrata','sectionalLeft'],['side-right','Bočno klizna segmentna garažna vrata','sectionalRight'],
 ['highspeed','Brza rolo industrijska vrata','roll'],['industrial','Industrijska segmentna vrata','sectional'],
 ['vertical','Vertikalno podizna industrijska vrata','slideUp'],['hanger','Klizna industrijska vrata','slideLeft'],
] as const){
 const side=id==='side-left'?'ulevo':id==='side-right'?'udesno':'';
 addModel('garage',doorCategory,system,`g-${id}`,side,3000,2400,[row([move],1,'panel')],{keywords:'garaža radionica hangar magacin'});
 if(!['roll','highspeed'].includes(id))addModel('garage',doorCategory,system,`g-${id}-top`,[side,'sa nadsvetlom'].filter(Boolean).join(', '),3000,2800,[row(fill(3,fixed),400),row([move],2400,'panel')]);
}
addModel('garage',doorCategory,'Krilna garažna vrata ka spolja','g-hinged','dva krila',2600,2200,[row(['outLeft','outRight'],1,'panel')]);
addModel('garage',doorCategory,'Sklopiva industrijska vrata','g-fold','2 levo + 2 desno',4400,3000,[row(['foldLeft','foldLeft','foldRight','foldRight'],1,'panel')]);
addModel('doors',doorCategory,'Dvodelna vrata sa nezavisnom gornjom polovinom','d-dutch-left','šarke levo',950,2100,[row(['left'],1),row(['left'],1,'panel')],{keywords:'holandska vrata dutch stable'});
addModel('doors',doorCategory,'Dvodelna vrata sa nezavisnom gornjom polovinom','d-dutch-right','šarke desno',950,2100,[row(['right'],1),row(['right'],1,'panel')],{keywords:'holandska vrata dutch stable'});

const shapes:[ShapeVariant,string,number,number][]=[
 ['circle','Okrugli prozor',900,900],['ellipse','Elipsasti prozor',1200,800],['arch-top','Polukružno nadsvetlo',1400,700],
 ['arch','Lučni prozor',1400,1650],['segment','Prozor sa plitkim lukom',1400,1500],['quarter','Četvrtkružni prozor',900,900],
 ['triangle','Pravougli trouglasti prozor',1200,900],['mirror-triangle','Pravougli trouglasti prozor, ogledalo',1200,900],
 ['iso-triangle','Jednakokraki trouglasti prozor',1400,900],['trapezoid','Trapezni prozor, kosina raste desno',1400,1100],
 ['mirror-trapezoid','Trapezni prozor, kosina raste levo',1400,1100],['parallelogram','Paralelogramski prozor',1400,1100],
 ['diamond','Rombasti prozor',1000,1000],['polygon','Petougaoni prozor',1400,1500],['hexagon','Šestougaoni prozor',1100,950],
 ['octagon','Osmougaoni prozor',1000,1000],['gothic','Prozor sa šiljatim lukom',1200,1700],
];
for(const [variant,name,width,height] of shapes)models.push({id:`shape-${variant}`,name,group:'shapes',category:windowCategory,width,height,material:'ALU',shape:{variant},keywords:'nepravilan geometrija fiksni oblik'});
models.push({id:'r-light-tunnel',name:'Cevni krovni svetlarnik',group:'roof',category:windowCategory,width:350,height:350,material:'ALU',shape:{variant:'circle'},keywords:'sun tunnel svetlosni tunel'});
for(const [variant,name,hinge] of [['trapezoid','Trapezni zaokretni prozor · šarke levo','left'],['mirror-trapezoid','Trapezni zaokretni prozor · šarke desno','right']] as const){
 models.push({id:`shape-turn-${variant}`,name,group:'shapes',category:windowCategory,width:1200,height:1100,material:'ALU',shape:{variant,hinge}});
}
for(const [id,variant,name,category,width,height] of [
 ['window','arch','Lučni prozor sa odvojenim nadsvetlom',windowCategory,1400,1900],
 ['door','arch','Lučna ulazna vrata sa nadsvetlom',entranceCategory,1100,2650],
 ['shallow','segment','Ulazna vrata sa plitkim lučnim nadsvetlom',entranceCategory,1200,2450],
] satisfies [string,ShapeVariant,string,Category,number,number][]){
 for(const split of ['left','right','fixed'] as const){
  if(category!==windowCategory&&split==='fixed')continue;
  models.push({id:`shape-arch-${id}-${split}`,name:`${name} · ${split==='left'?'šarke levo':split==='right'?'šarke desno':'fiksno'}`,group:'shapes',category,width,height,material:'ALU',shape:{variant,split}});
 }
}

export const catalogModels: readonly CatalogModel[]=models;
const byId=new Map(catalogModels.map(model=>[model.id,model]));
export const findCatalogModel=(id:string|null|undefined)=>id?byId.get(id):undefined;

function contour(coords:Point[], arcs:Partial<Record<number,Point>>={}):Geometry {
 const points=coords.map((point,i)=>({...point,id:`p${i}`}));
 return {version:1,preset:'free',points,bars:[],edges:points.map((point,i)=>({id:`e${i}`,from:point.id,to:points[(i+1)%points.length].id,...(arcs[i]?{kind:'arc',via:arcs[i]}:{kind:'line'})}))};
}

export function modelGeometry({shape:{variant,split,hinge},width:w,height:h}:ModelBase & {shape:ShapeModel}):Geometry {
 const p=(x:number,y:number):Point=>({x:x*w,y:y*h});
 let g:Geometry;
 switch(variant){
  case 'iso-triangle': g=contour([p(0,1),p(.5,0),p(1,1)]);break;
  case 'mirror-triangle': g=contour([p(0,1),p(1,0),p(1,1)]);break;
  case 'mirror-trapezoid': g=contour([p(0,1),p(0,0),p(1,.25),p(1,1)]);break;
  case 'parallelogram': g=contour([p(0,1),p(.22,0),p(1,0),p(.78,1)]);break;
  case 'diamond': g=contour([p(0,.5),p(.5,0),p(1,.5),p(.5,1)]);break;
  case 'hexagon': g=contour([p(0,.5),p(.25,0),p(.75,0),p(1,.5),p(.75,1),p(.25,1)]);break;
  case 'octagon': g=contour([p(0,.28),p(.28,0),p(.72,0),p(1,.28),p(1,.72),p(.72,1),p(.28,1),p(0,.72)]);break;
  case 'quarter': g=contour([p(0,0),p(1,1),p(0,1)],{0:p(Math.SQRT1_2,1-Math.SQRT1_2)});break;
  case 'gothic': g=contour([p(0,1),p(0,.38),p(.5,0),p(1,.38),p(1,1)],{1:p(.15,.16),2:p(.85,.16)});break;
  case 'segment': g=contour([p(0,1),p(0,.13),p(1,.13),p(1,1)],{1:p(.5,0)});break;
  case 'ellipse': {
   // Circular arcs approximate the ellipse for the field sketch.
   const at=(a:number)=>p(.5+.5*Math.cos(a),.5+.5*Math.sin(a));
   const step=Math.PI/4;
   g=contour(Array.from({length:8},(_,i)=>at(i*step)),Object.fromEntries(Array.from({length:8},(_,i)=>[i,at((i+.5)*step)])));
   break;
  }
  case 'arch-top': g=presetGeometry('arch',w,w/2);break;
  default: g=presetGeometry(variant,w,h);
 }
 if(split){
  const top=variant==='segment'?h*.13:w/2;
  g=divideWindow(g,{top,bottom:0,left:0,right:0},1);
  if(split!=='fixed'){
   const lower=openingRegions(g).sort((a,b)=>b.center.y-a.center.y)[0];
   if(lower)g.openings=[{region:lower.id,side:split}];
  }
 }
 if(hinge){const region=openingRegions(g)[0];if(region)g.openings=[{region:region.id,side:hinge}];}
 return g;
}

export function applyCatalogModel(position:Position,model:CatalogModel):Position {
 const base={...position,name:model.name,category:model.category,material:model.material,profile:model.material==='ALU'?'ALU termo profil':'PVC 70 mm',width:model.width,height:model.height,segments:[{width:model.width,opening:'Fiksno' as const}]};
 if(!model.shape)return {...base,elementType:'model',modelLayout:structuredClone(model.layout)};
 const geometry=modelGeometry(model);
 const size=bounds(geometry);
 return {...base,width:size.width,height:size.height,segments:[{width:size.width,opening:'Fiksno'}],elementType:'nacrtaj',customGeometry:geometry,customInfill:'glass',customKind:model.category==='Prozori'?'window':'door'};
}
