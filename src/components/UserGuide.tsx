import { useState } from 'react';
import { Download } from 'lucide-react';
import { downloadFile } from '../services/documents';
import { guideChapters, guideIntro } from '../user-guide';
import './user-guide.css';

export function UserGuide() {
 const [downloading, setDownloading] = useState(false);
 const [error, setError] = useState('');

 async function downloadGuide() {
  setDownloading(true);
  setError('');
  try {
   const { makeUserGuidePdf } = await import('../services/user-guide-pdf');
   downloadFile(await makeUserGuidePdf());
  } catch {
   setError('PDF trenutno nije dostupan. Pokušajte ponovo.');
  } finally {
   setDownloading(false);
  }
 }

 return <div className="user-guide">
  <header className="user-guide-start">
   <p>{guideIntro}</p>
   <button type="button" className="field-button field-button-yellow" disabled={downloading} onClick={() => void downloadGuide()}>
    <Download aria-hidden="true" />
    {downloading ? 'Pripremam PDF…' : 'Preuzmi PDF'}
   </button>
  </header>
  {error && <p className="field-error" role="alert">{error}</p>}
  <nav className="user-guide-contents" aria-labelledby="uputstvo-sadrzaj">
   <h2 id="uputstvo-sadrzaj" tabIndex={-1}>Sadržaj</h2>
   <ol>
    {guideChapters.map(chapter => <li key={chapter.id}>
     <a href={`#uputstvo-${chapter.id}`}>{chapter.title}</a>
    </li>)}
   </ol>
  </nav>
  {guideChapters.map(chapter => {
   const heading = `uputstvo-${chapter.id}`;
   return <section className="user-guide-chapter" aria-labelledby={heading} key={chapter.id}>
    <h2 id={heading} tabIndex={-1}>{chapter.title}</h2>
    {chapter.blocks.map((block, index) => {
     if ('text' in block) return <div className="user-guide-block" key={index}>
      {block.heading && <h3>{block.heading}</h3>}
      <p>{block.text}</p>
     </div>;
     const List = block.ordered ? 'ol' : 'ul';
     return <div className="user-guide-block" key={index}>
      {block.heading && <h3>{block.heading}</h3>}
      <List>{block.items.map(item => <li key={item}>{item}</li>)}</List>
     </div>;
    })}
    <a className="user-guide-return" href="#uputstvo-sadrzaj">Na sadržaj</a>
   </section>;
  })}
 </div>;
}
