import { useState } from 'react';
import { Download } from 'lucide-react';
import type { Job, Settings } from '../models';
import { downloadFile, makeDocument } from '../services/documents';
import { validatePosition } from '../services/calculation';

export function DocumentDownloads({job,settings}:{job:Job;settings:Settings}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const ready=job.positions.length>0&&!job.positions.some(p=>validatePosition(p).length);
 async function download(kind:'kupac'|'kancelarija'){
  setBusy(true);setMessage('');
  try{downloadFile(await makeDocument(job,settings,kind));setMessage('PDF je pripremljen za preuzimanje.');}
  catch(e){setMessage(`Izvoz nije uspeo: ${(e as Error).message}`);}finally{setBusy(false);}
 }
 return <>{(['kupac','kancelarija'] as const).map(kind=><button key={kind} disabled={busy||!ready} className={`field-button ${kind==='kupac'?'field-button-yellow':'field-button-light'}`} onClick={()=>download(kind)}><Download/>{kind==='kupac'?'Ponuda za kupca':'Specifikacija za kancelariju'}</button>)}{message&&<p className="document-download-message" role="status">{message}</p>}</>;
}
