import type { Job } from '../models';
import { useStore } from '../store';

export function JobAssignmentInfo({job,compact=false}:{job:Job;compact?:boolean}){
 const member=useStore(s=>s.teamMember),origin=useStore(s=>s.teamJobOrigins[job.id]),assignedTo=useStore(s=>s.teamAssignments[job.id]);
 if(!member||!origin)return null;
 const creator=origin.created_by_name||(origin.created_by===member.id?member.name:'Nije zabeleženo');
 const sender=origin.assigned_by_name||(origin.assigned_by===member.id?member.name:origin.assigned_by?'Nije zabeleženo':'Nije poslato');
 const recipient=assignedTo?origin.assigned_to_name||job.technician||'Zadužena osoba':'Nije dodeljeno';
 const hasRequest=Boolean(origin.assigned_by||origin.assigned_by_name);
 if(compact)return <div className="job-origin-compact"><span>Kreirao: {creator}</span>{hasRequest&&<span>Zahtev: {sender} → {recipient}</span>}</div>;
 return <section className="job-assignment-info" aria-label="Kreiranje i dodela posla">
  <h2>Kreiranje i dodela</h2>
  <dl><div><dt>Kreirao posao</dt><dd>{creator}</dd></div><div><dt>Zahtev za merenje poslao</dt><dd>{sender}</dd></div><div><dt>Merenje dodeljeno</dt><dd>{recipient}</dd></div></dl>
  {hasRequest&&<p>Dodelu merenja može da promeni samo {sender}.</p>}
 </section>;
}
