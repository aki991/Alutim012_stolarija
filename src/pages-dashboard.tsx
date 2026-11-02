import { Link, useNavigate } from 'react-router-dom';
import { Calculator, ChevronRight, FileText, MapPin, Plus } from 'lucide-react';
import { useStore } from './store';
import { Button, CategoryIcon, Empty, Saved } from './components/UI';
import { categories } from './catalog';

/** Reference composition, with real job data and accessible controls. */
export function Dashboard({ onNew }: { onNew: () => void }) {
  const { jobs, saveState } = useStore();
  const navigate = useNavigate();
  const active = jobs.filter(job => job.status !== 'Završeno');
  const last = active[0];

  return <div className="reference-home">
    <section className="reference-hero" aria-labelledby="reference-title">
      <div className="reference-hero-photo" aria-hidden="true">
        <svg className="reference-facade-wide" viewBox="552 156 416 248" preserveAspectRatio="xMidYMid slice"><image href="/assets/reference.png" width="1672" height="941" /></svg>
        <svg className="reference-facade-phone" viewBox="14 109 302 204" preserveAspectRatio="xMidYMid slice"><image href="/assets/reference-phone.png" width="338" height="735" /></svg>
      </div>
      <div className="reference-hero-content">
        <h1 id="reference-title">Brza ponuda<br /><em>na terenu</em></h1>
        <p>Merenje <span>•</span> Specifikacija <span>•</span><br />Kalkulacija <span>•</span> Ponuda</p>
        <Button className="reference-new-job" onClick={onNew}><Plus aria-hidden="true" />Novi posao</Button>
      </div>
    </section>
    <div className="reference-workspace">
      <nav className="reference-categories" aria-label="Vrste stolarije">
        {categories.map(category => <Link key={category} to={`/katalog?tip=${encodeURIComponent(category)}`} className="reference-category">
          <CategoryIcon category={category} size={38} /><span>{category}</span>
        </Link>)}
      </nav>
      <div className="reference-panels">
        <section className="reference-active" aria-labelledby="active-title">
          <header><h2 id="active-title">Aktivni poslovi</h2><Link to="/poslovi">Vidi sve <ChevronRight aria-hidden="true" /></Link></header>
          <div className="reference-job-list">
            {active.slice(0, 3).map(job => <Link className="reference-job" to={`/posao/${job.id}`} key={job.id}>
              <span className="reference-job-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M3 3h26v26H3zM6 6h20v20H6zM16 6v20M7 7l6 2v14l-6 2M18 8h6v16h-6" /></svg></span>
              <span className="reference-customer"><strong>{job.customer.name}</strong><small><MapPin aria-hidden="true" />{job.customer.address}</small></span>
              <span className={`reference-status reference-status-${job.status === 'U izradi' ? 'progress' : job.status === 'Ponuda' ? 'offer' : 'review'}`}>{job.status}</span>
              <ChevronRight className="reference-job-arrow" aria-hidden="true" />
            </Link>)}
            {!active.length && <Empty title="Nema aktivnih poslova" action={<Button onClick={onNew}>Novi posao</Button>} />}
          </div>
        </section>
        <section className="reference-actions" aria-labelledby="actions-title">
          <h2 id="actions-title">Brze akcije</h2>
          <div>
            <button onClick={() => navigate(last ? `/posao/${last.id}/ponuda` : '/ponude')}><Calculator aria-hidden="true" /><span>Nova<br />ponuda</span></button>
            <button onClick={() => navigate(last ? `/posao/${last.id}/ponuda` : '/ponude')}><span className="reference-pdf-icon"><FileText aria-hidden="true" /><b>PDF</b></span><span>Ponuda<br />za kupca</span></button>
            <button onClick={() => navigate(last ? `/posao/${last.id}/ponuda?dokument=kancelarija` : '/poslovi')}><FileText aria-hidden="true" /><span>Specifikacija<br />za kancelariju</span></button>
          </div>
        </section>
      </div>
    </div>
    <div className="reference-local-state"><Saved state={saveState} />{last && <Link to={`/posao/${last.id}`}>Nastavi merenje <ChevronRight size={14} /></Link>}</div>
  </div>;
}
