import { useMemo, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import type { Job, Position } from '../models';
import { downloadFile } from '../services/documents';
import { cutListNotes, elementCutList, specialCutText, type ProfileCut } from './cut-list';
import { formatAngle } from './geometry';
import { CutListDiagram } from './CutListDiagram';
import './cut-list.css';

const lengthFormat=new Intl.NumberFormat('sr-Latn-RS',{maximumFractionDigits:1});
function CutValue({cut}:{cut:ProfileCut}){
 if(cut.angle===null)return <span className="cut-list-special">{specialCutText(cut)}</span>;
 return <><strong>{formatAngle(cut.angle)}</strong><small>Testera {formatAngle(cut.saw!)}</small>{cut.concave&&<small>Uvučen spoj</small>}</>;
}

export function ElementCutList({position,job}:{position:Position;job:Pick<Job,'id'|'customer'>}){
 const list=useMemo(()=>elementCutList(position),[position]);
 const [expanded,setExpanded]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!list)return null;
 async function download(){
  if(busy)return;setBusy(true);setError('');
  const snapshot=structuredClone(position);
  try{const {makeCutListDocument}=await import('../services/cut-list-document');downloadFile(await makeCutListDocument(job,snapshot));}
  catch(failure){setError(failure instanceof Error?failure.message:'Preuzimanje krojne liste nije uspelo. Pokušajte ponovo.');}
  finally{setBusy(false);}
 }
 return <section className="element-cut-list" aria-label={`Krojna lista: ${position.name}`}>
  <header><button type="button" className="cut-list-toggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><ChevronDown/><span>Krojna lista <small>Spoljašnji ram · {list.rows.length} profila</small></span></button><button type="button" className="field-button field-button-light cut-list-download" disabled={busy} onClick={()=>void download()}><Download size={18}/>{busy?'Pripremam PDF…':'Preuzmi krojnu listu (PDF)'}</button></header>
  {error&&<p className="field-error" role="alert">{error}</p>}
  {expanded&&<div className="cut-list-content"><div className="cut-list-body"><div className="cut-list-diagram"><CutListDiagram list={list}/></div><div className="cut-list-table-wrap"><table><caption>{position.name} · {position.quantity} {position.quantity===1?'element':'elemenata'}</caption><thead><tr><th scope="col">Profil</th><th scope="col">Dužina (mm)</th><th scope="col">Rez na početku</th><th scope="col">Rez na kraju</th><th scope="col">Kom.</th></tr></thead><tbody>{list.rows.map(row=><tr key={row.id}><th scope="row">{row.label}<small>{row.from} → {row.to}</small>{row.kind==='arc'&&<small>Lučni profil</small>}{row.kind==='threshold'&&<small>ALU prag</small>}</th><td>{lengthFormat.format(row.length)}{row.radius&&<small>R {lengthFormat.format(row.radius)}</small>}</td><td><CutValue cut={row.start}/></td><td><CutValue cut={row.end}/></td><td>{row.quantity}</td></tr>)}</tbody></table></div></div><div className="cut-list-notes">{cutListNotes.map(note=><p key={note}>{note}</p>)}{list.hasBars&&<p>Lista obuhvata spoljašnji ram. Prečke i krila imaju zasebne spojeve.</p>}</div></div>}
 </section>;
}
