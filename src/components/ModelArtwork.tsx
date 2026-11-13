import { glassPanelFraction, infills, movements, weightTotal, type ModelLayout, type Movement } from '../model-layout';

type Box = {x:number;y:number;width:number;height:number};

function Marks({move,box}:{move:Movement;box:Box}) {
 const {x,y,width:w,height:h}=box;
 const l=x+w*.12,r=x+w*.88,t=y+h*.12,b=y+h*.88,mx=x+w/2,my=y+h/2;
 const arrow=Math.min(w*.14,h*.15,8);
 const swingLeft=`M${l} ${t}L${r} ${my}L${l} ${b}`;
 const swingRight=`M${r} ${t}L${l} ${my}L${r} ${b}`;
 const tilt=`M${l} ${b}L${mx} ${t}L${r} ${b}`;
 const awning=`M${l} ${t}L${mx} ${b}L${r} ${t}`;
 const pivot=(axis:number)=>`M${axis} ${t}V${b} M${l} ${my}L${axis} ${t} ${r} ${my} ${axis} ${b}Z`;
 const arrows={
  left:`M${r} ${my}H${l}m${arrow} ${-arrow}l${-arrow} ${arrow} ${arrow} ${arrow}`,
  right:`M${l} ${my}H${r}m${-arrow} ${-arrow}l${arrow} ${arrow} ${-arrow} ${arrow}`,
  up:`M${mx} ${b}V${t}m${-arrow} ${arrow}l${arrow} ${-arrow} ${arrow} ${arrow}`,
  down:`M${mx} ${t}V${b}m${-arrow} ${-arrow}l${arrow} ${arrow} ${arrow} ${-arrow}`,
 };
 const paths:Record<Movement,string>={
  fixed:'',left:swingLeft,right:swingRight,tilt,tiltLeft:swingLeft+tilt,tiltRight:swingRight+tilt,
  outLeft:swingLeft,outRight:swingRight,awning,outBottom:tilt,projected:awning+`M${l} ${t+h*.1}H${r}`,
  parallel:`M${l} ${t}H${r}V${b}H${l}Z M${l} ${t}l${arrow} ${arrow} M${r} ${t}l${-arrow} ${arrow} M${l} ${b}l${arrow} ${-arrow} M${r} ${b}l${-arrow} ${-arrow}`,
  pivotH:`M${l} ${my}H${r} M${mx} ${t}L${r} ${my} ${mx} ${b} ${l} ${my}Z`,
  pivotV:pivot(mx),pivotVLeft:pivot(x+w*.25),pivotVRight:pivot(x+w*.75),
  doubleLeft:swingLeft+`M${l} ${my}H${mx}`,doubleRight:swingRight+`M${r} ${my}H${mx}`,
  slideLeft:arrows.left,slideRight:arrows.right,slideUp:arrows.up,slideDown:arrows.down,
  foldLeft:`M${l} ${t}L${mx} ${my} ${l} ${b} M${mx} ${t}L${r} ${my} ${mx} ${b}`,foldRight:`M${r} ${t}L${mx} ${my} ${r} ${b} M${mx} ${t}L${l} ${my} ${mx} ${b}`,
  louvre:`M${l} ${my+arrow}l${arrow*2} ${-arrow*2}m${-arrow} 0h${arrow}v${arrow}`,
  revolve:'',roll:arrows.up,sectional:arrows.up,sectionalLeft:arrows.left,sectionalRight:arrows.right,canopy:arrows.up+awning,
 };
 const dashed=['left','right','tilt','tiltLeft','tiltRight','outLeft','outRight','awning','outBottom','projected','parallel','pivotH','pivotV','pivotVLeft','pivotVRight','doubleLeft','doubleRight','foldLeft','foldRight'].includes(move);
 return paths[move]?<path data-model-movement={move} d={paths[move]} fill="none" stroke="#283a43" strokeWidth={Math.min(1.8,w/12,h/12)} strokeDasharray={dashed?'5 3':undefined}/>:null;
}

export function ModelArtwork({layout,box,glass,compact}:{layout:ModelLayout;box:Box;glass:string;compact:boolean}) {
 const {x,y,width,height}=box;
 const total=weightTotal(layout.rows);
 const wings=layout.rows[0].cells;
 const revolving=layout.rows.length===1&&wings.every(cell=>cell.movement==='revolve');
 let top=y;
 return <g data-model-artwork="true">
  {layout.rows.map((row,rowIndex)=>{
   const rowHeight=height*row.weight/total,sy=top;
   top+=rowHeight;
   const rowTotal=weightTotal(row.cells);
   let left=x;
   return <g key={rowIndex}>{row.cells.map((cell,index)=>{
    const cellWidth=width*cell.weight/rowTotal,sx=left;
    left+=cellWidth;
    if(cell.infill==='space')return null;
    const inset=Math.min(6,cellWidth*.14,rowHeight*.14);
    const pane={x:sx+inset,y:sy+inset,width:cellWidth-2*inset,height:rowHeight-2*inset};
    const louvres=cell.infill==='slats'||cell.movement==='roll';
    const sectional=cell.movement==='sectional';
    const vertical=cell.movement==='sectionalLeft'||cell.movement==='sectionalRight';
    return <g key={index}>
     <title>{`${infills[cell.infill]} · ${movements[cell.movement]}`}</title>
     <rect x={sx} y={sy} width={cellWidth} height={rowHeight} fill="#f5f5f3" stroke="#1f2529" strokeWidth="1.7"/>
     <rect {...pane} fill={cell.infill==='panel'?'#ddd9d1':glass} stroke="#26343a" strokeWidth="1.2"/>
     {cell.infill==='glassPanel'&&<rect x={pane.x} y={pane.y+pane.height*glassPanelFraction} width={pane.width} height={pane.height*(1-glassPanelFraction)} fill="#ddd9d1" stroke="#26343a" strokeWidth="1.2"/>}
     {(louvres||sectional||vertical)&&Array.from({length:louvres?10:4},(_,i)=>{
      const f=(i+1)/(louvres?11:5);
      return <path key={i} d={vertical?`M${pane.x+pane.width*f} ${pane.y}v${pane.height}`:`M${pane.x} ${pane.y+pane.height*f}h${pane.width}`} fill="none" stroke="#52636c" strokeWidth=".9"/>;
     })}
     <Marks move={cell.movement} box={pane}/>
     {layout.cornerAfter===index+1&&<g><title>Ugao 90° · razvijeni pogled</title><path d={`M${left} ${sy-2}v${rowHeight+4}`} stroke="#991925" strokeWidth="2.4" strokeDasharray="6 3"/>{!compact&&<text x={left} y={sy+rowHeight+18} textAnchor="middle" fontFamily="Arial" fontSize="11" fill="#76131d">Ugao 90°</text>}</g>}
    </g>;
   })}</g>;
  })}
  {revolving&&(()=>{
   const cx=x+width/2,cy=y+height/2,radius=Math.min(width,height)*.23;
   return <g stroke="#283a43" strokeWidth="1.7" fill="#f2fbff"><circle cx={cx} cy={cy} r={radius}/>{wings.map((_,i)=>{const angle=i*2*Math.PI/wings.length;return <line key={i} x1={cx} y1={cy} x2={cx+Math.cos(angle)*radius} y2={cy+Math.sin(angle)*radius}/>;})}</g>;
  })()}
 </g>;
}
