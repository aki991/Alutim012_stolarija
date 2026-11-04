import { ChevronDown } from 'lucide-react';
import { jobStatuses, type Status } from '../models';

export function JobStatus({value,onChange,name=''}:{value:Status;onChange:(status:Status)=>void;name?:string}){
 return <label className={`job-status-select status-${value==='Ponuda'?'offer':value==='Prihvaćeno'||value==='Završeno'?'done':value==='Odbijeno'?'rejected':'progress'}`}>
  <span className="sr-only">Status posla{name?`: ${name}`:''}</span>
  <span className="job-status-dot" aria-hidden="true"/>
  <select value={value} onChange={e=>onChange(e.target.value as Status)}>
   {jobStatuses.map(status=><option key={status}>{status}</option>)}
  </select>
  <ChevronDown className="job-status-arrow" aria-hidden="true"/>
 </label>;
}
