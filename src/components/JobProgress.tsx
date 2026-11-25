import { Check } from 'lucide-react';
import type { Job } from '../models';
import { canEditJob, useStore } from '../store';
import { canFinishMeasurement } from '../services/job-progress';
import { formatMeasurementDate, scheduledMeasurementDate, useBelgradeToday } from '../services/measurement-schedule';
import { Field } from './UI';

export function JobProgress({job}:{job:Job}){
 const state=useStore(),editable=canEditJob(state,job),assignedTo=state.teamAssignments[job.id];
 const today=useBelgradeToday();
 const measuring=job.status==='Merenje';
 const canMeasure=editable&&(!assignedTo||assignedTo===state.teamMember?.id);
 const canInstall=editable&&['Prihvaćeno','U izradi','Završeno'].includes(job.status)&&job.positions.length>0;
 const update=(patch:Partial<Job>)=>{state.updateJob(job.id,patch);useStore.getState().retrySave();};
 return <section className="job-progress" aria-label="Evidencija posla">
  <div className="job-progress-heading"><h2>Evidencija posla</h2><p>{assignedTo?`Merenje dodeljeno: ${job.technician||'Zadužena osoba'}`:state.teamMember?'Merenje nije dodeljeno':`Merenje: ${job.technician||'Nije navedeno'}`}</p></div>
  <div className="job-progress-dates">
   <Field label="Rok završetka"><input type="date" required={measuring} readOnly={!editable} min={measuring?job.measuredOn||today:undefined} value={job.completionDeadline||''} onChange={e=>update({completionDeadline:e.target.value})}/></Field>
   <dl>{([['Izmereno',job.measuredOn],['Završeno',job.completedOn],['Ugrađeno',job.installedOn]] as const).map(([label,date])=><div key={label}><dt>{label}</dt><dd>{date?<time dateTime={date}>{formatMeasurementDate(date)}</time>:'Nije zabeleženo'}</dd></div>)}</dl>
  </div>
  {measuring&&canMeasure&&<div className="job-progress-actions"><button type="button" className="field-button field-button-yellow" disabled={!canFinishMeasurement(job)} onClick={()=>update({status:'Poslati ponudu',date:scheduledMeasurementDate(job,Boolean(assignedTo),today)})}><Check size={19}/>Merenje završeno</button><small>{!job.positions.length?'Dodajte izmerene elemente i unesite rok završetka.':!canFinishMeasurement(job)?'Unesite rok završetka, od dana merenja nadalje.':'Potvrdom se beleži današnji datum merenja.'}</small></div>}
  {canInstall&&<div className="job-progress-actions"><button type="button" className="field-button field-button-yellow" onClick={()=>update({status:'Ugrađeno'})}><Check size={19}/>Ugrađeno</button><small>Potvrdom se beleži današnji datum ugradnje i završetka posla.</small></div>}
 </section>;
}
