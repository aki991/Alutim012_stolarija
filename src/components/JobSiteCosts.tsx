import type { Job } from '../models';
import { siteTravel } from '../services/site-costs';
import { Field } from './UI';
import { NumberInput } from './NumberInput';
import { useStore } from '../store';

export function JobSiteCosts({job,readOnly=false,onChange}:{job:Job;readOnly?:boolean;onChange:(patch:Partial<Job>)=>void}){
 const hiddenPrices=useStore(s=>s.teamMember?.role==='worker'&&s.settings.showPrices===false);
 return <section className="job-site-costs" aria-label="Troškovi za obračun stolarije">
  <h2>Cena montaže i puta</h2>
  <div className="field-options-grid">
   <Field label="Cena montaže za ceo posao (€)"><NumberInput clearToZero readOnly={readOnly} inputMode="decimal" min={0} max={1e8} step="0.01" placeholder="Nije uneto" value={job.siteCosts?.installation??''} onChange={e=>{const amount=Number(e.target.value);if(Number.isFinite(amount)&&amount>=0&&amount<=1e8)onChange({siteCosts:{...job.siteCosts,installation:amount}});}}/></Field>
   <Field label="Cena puta za ceo posao (€)"><NumberInput clearToZero readOnly={readOnly} inputMode="decimal" min={0} max={1e8} step="0.01" value={siteTravel(job)} onChange={e=>{const amount=Number(e.target.value);if(Number.isFinite(amount)&&amount>=0&&amount<=1e8)onChange({siteCosts:{...job.siteCosts,travel:amount}});}}/></Field>
  </div>
  <p>Iznosi se ravnomerno raspoređuju po komadu i ulaze u cenu stolarije. U ponudi se ne prikazuju kao posebne stavke.</p>
  {hiddenPrices&&<p>Montažu i put možete uneti za šefa i kada su cene stolarije sakrivene.</p>}
 </section>;
}
