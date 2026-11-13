export function ElementGlyph({type='prozor',wings=2,opening}:{type?:string;wings?:number;opening?:string}){
 if(type==='sobna-vrata')return <svg viewBox="0 0 80 82" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 76V7h36v69H22z" fill="#eee8df"/><path d="M27 76V12h26v64M33 19h14v43H33zM46 44h6"/></svg>;
 if(type==='nacrtaj')return <svg viewBox="0 0 80 82" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 67V12L70 67ZM17 60V28L54 60Z" fill="#dff3fc"/><path d="m42 24 5-5 21 21-5 5Z m-1-1-4 9 9-4" fill="#fff"/></svg>;
 const door=['vrata','balkonska'].includes(type),x=door?24:10,w=door?32:60,y=door?5:12,h=door?70:56;
 const count=door||['fiksni','roletna','komarnik'].includes(type)?1:wings;
 return <svg viewBox="0 0 80 82" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
 {type==='kombinacija'?<><path d="M8 6h30v29h34v40H8zM38 35v40"/><path d="M12 10h22v61H12zM42 39h26v32H42z" fill="#dff3fc"/><path d="M31 41h-5"/></>:type==='ostalo'?<path d="M15 18h50v48H15zM40 27v30M25 42h30"/>:
 <><rect x={x} y={y} width={w} height={h}/>
 {Array.from({length:count},(_,i)=>{const sw=w/count,l=x+i*sw+4,r=x+(i+1)*sw-4,t=y+4,b=y+h-4,mid=(t+b)/2;const turn=opening?.startsWith('Desno')||(!opening&&i>0)?`M${r} ${t}L${l} ${mid}L${r} ${b}`:`M${l} ${t}L${r} ${mid}L${l} ${b}`;const tilt=`M${l} ${b}L${(l+r)/2} ${t}L${r} ${b}`;return <g key={i}><rect x={l} y={t} width={Math.max(1,r-l)} height={b-t} fill={type==='vrata'?'#f7f7f7':['roletna','komarnik'].includes(type)?'none':'#dff3fc'}/>
 {type==='klizni'?<path d={i===0?`M${l+3} ${mid}H${r-3}m-5 -4l5 4-5 4`:`M${r-3} ${mid}H${l+3}m5 -4l-5 4 5 4`}/>:type==='roletna'?Array.from({length:9},(_,k)=><path key={k} d={`M${l} ${t+(b-t)*k/9}H${r}`}/>):type==='komarnik'?Array.from({length:12},(_,k)=><path key={k} d={`M${l} ${t+(b-t)*k/12}H${r}M${l+(r-l)*k/12} ${t}V${b}`} strokeWidth=".75"/>):type==='vrata'?<path d={`M${r-1} ${mid}h-6m3 -3v6`}/>:type==='balkonska'?<path d={`M${l+4} ${b-8}L${r-4} ${t+8}`} stroke="#fff" strokeWidth="3"/>:type==='fiksni'||opening==='Fiksno'?null:<path d={opening==='Kip'?tilt:turn+(opening?.endsWith(' + kip')?tilt:'')} strokeDasharray="3 2" strokeWidth="1.4"/>}</g>;})}</>}
 </svg>;
}
