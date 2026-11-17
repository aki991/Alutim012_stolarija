import type { jsPDF } from 'jspdf';

const arialFonts = [
 { url: '/assets/arial.ttf', fileName: 'Arial.ttf', style: 'normal' },
 { url: '/assets/arial-bold.ttf', fileName: 'ArialBold.ttf', style: 'bold' },
] as const;

let fontData: Promise<string[]> | undefined;

async function readFont(url: string) {
 const response = await fetch(url);
 if (!response.ok) throw new Error('Font za PDF nije dostupan.');
 const bytes = new Uint8Array(await response.arrayBuffer());
 let text = '';
 for (let index = 0; index < bytes.length; index += 8192) {
  text += String.fromCharCode(...bytes.subarray(index, index + 8192));
 }
 return btoa(text);
}

export async function registerPdfFonts(doc: jsPDF) {
 fontData ??= Promise.all(arialFonts.map(({ url }) => readFont(url))).catch(error => {
  fontData = undefined;
  throw error;
 });
 const files = await fontData;
 arialFonts.forEach(({ fileName, style }, index) => {
  doc.addFileToVFS(fileName, files[index]);
  doc.addFont(fileName, 'Arial', style);
 });
}
