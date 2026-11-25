import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

export async function pdfText(page:Page,path:string){
 return page.evaluate(async data=>{
  const {getDocument,GlobalWorkerOptions}=await import('/node_modules/pdfjs-dist/build/pdf.mjs');
  GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.mjs';
  const loading=getDocument({data:new Uint8Array(data),useWasm:false}),pdf=await loading.promise;
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){
   const content=await (await pdf.getPage(i)).getTextContent();
   pages.push(content.items.map((item:{str?:string})=>item.str||'').join(' '));
  }
  await loading.destroy();return pages.join(' ');
 },Array.from(await readFile(path)));
}
