import { guideChapters, guideIntro, guideTitle } from '../user-guide';
import { registerPdfFonts } from './pdf-fonts';

const burgundy = '#590c14';
const ink = '#232c34';
const muted = '#495562';
const margin = 19;
const pageRight = 210 - margin;
const width = pageRight - margin;
const lineHeight = 5.15;
const bodySize = 10.8;

export async function makeUserGuidePdf() {
 const { jsPDF } = await import('jspdf');
 const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
 await registerPdfFonts(doc);
 doc.setProperties({ title: guideTitle, author: 'ALU TIM 012', subject: 'Uputstvo za aplikaciju Stolarija' });

 function font(size: number, color: string, bold = false) {
  doc.setFont('Arial', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(color);
 }

 function band() {
  doc.setFillColor(burgundy);
  doc.rect(0, 0, 210, 19, 'F');
  doc.setFillColor('#f1bc49');
  doc.rect(margin, 7, 1, 5, 'F');
  font(10, '#ffffff', true);
  doc.text('ALU TIM 012  /  STOLARIJA', margin + 4, 11);
 }

 band();
 font(27, burgundy, true);
 doc.text(guideTitle, margin, 39);
 font(11, muted);
 doc.text(doc.splitTextToSize(guideIntro, width), margin, 50);
 font(15, ink, true);
 doc.text('Sadržaj', margin, 70);

 let y = 31;
 doc.addPage();
 band();
 function ensureSpace(height: number) {
  if (y + height <= 274) return;
  doc.addPage();
  band();
  y = 31;
 }

 function paragraphLines(text: string, indent = 0) {
  font(bodySize, ink);
  return doc.splitTextToSize(text, width - indent) as string[];
 }

 function writeParagraph(lines: string[], label?: string) {
  const indent = label ? 8 : 0;
  ensureSpace(lines.length * lineHeight + 2);
  font(bodySize, ink);
  if (label) doc.text(label, margin, y);
  doc.text(lines, margin + indent, y, { lineHeightFactor: lineHeight * 72 / 25.4 / bodySize });
  y += lines.length * lineHeight + 2;
 }

 const links = guideChapters.map((chapter, index) => {
  const first = chapter.blocks[0];
  const hasHeading = Boolean(first.heading);
  const firstLines = 'items' in first ? paragraphLines(first.items[0], 8) : paragraphLines(first.text);
  ensureSpace(15 + (hasHeading ? 8 : 0) + firstLines.length * lineHeight + 2);
  const pageNumber = doc.getNumberOfPages();
  const top = y - 7;
  font(16, burgundy, true);
  doc.text(`${index + 1}. ${chapter.title}`, margin, y);
  y += 9;

  for (const block of chapter.blocks) {
   const firstLines = 'items' in block ? paragraphLines(block.items[0], 8) : paragraphLines(block.text);
   if (block.heading) {
    ensureSpace(8 + firstLines.length * lineHeight + 2);
    font(11.5, ink, true);
    doc.text(block.heading, margin, y);
    y += 7;
   }
   if ('items' in block) {
    block.items.forEach((item, itemIndex) => {
     writeParagraph(paragraphLines(item, 8), block.ordered ? `${itemIndex + 1}.` : '•');
    });
   } else writeParagraph(firstLines);
   y += 2;
  }
  y += 7;
  return { chapter, pageNumber, top };
 });

 doc.setPage(1);
 links.forEach(({ chapter, pageNumber, top }, index) => {
  const row = 83 + index * 13;
  font(10, burgundy, true);
  doc.text(String(index + 1).padStart(2, '0'), margin, row);
  font(11, ink);
  doc.text(chapter.title, margin + 11, row);
  doc.text(String(pageNumber), pageRight, row, { align: 'right' });
  doc.setDrawColor('#e5e8eb');
  doc.line(margin, row + 4, pageRight, row + 4);
  doc.link(margin, row - 5, width, 10, { pageNumber, top });
 });

 const pages = doc.getNumberOfPages();
 for (let number = 1; number <= pages; number++) {
  doc.setPage(number);
  doc.setDrawColor('#dce1e5');
  doc.line(margin, 281, pageRight, 281);
  font(8.5, muted);
  doc.text(guideTitle, margin, 287);
  doc.text(`${number} / ${pages}`, pageRight, 287, { align: 'right' });
 }

 return new File([doc.output('blob')], 'ALU-TIM-012-Uputstvo.pdf', { type: 'application/pdf' });
}
