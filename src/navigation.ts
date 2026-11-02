import { create } from 'zustand';
type Navigation = { jobId:string|null; workPath:string|null; sidebar:'auto'|'open'|'compact'; fullscreen:boolean; remember:(id:string,path:string)=>void; clearJob:()=>void; toggleSidebar:(compact:boolean)=>void; setFullscreen:(value:boolean)=>void };
let saved:Partial<Navigation>={};
try{saved=JSON.parse(sessionStorage.getItem('alu-navigation-v1')||'{}');}catch{/* Navigation preferences never block field work. */}
export const useNavigation=create<Navigation>((set)=>({
 jobId:typeof saved.jobId==='string'?saved.jobId:null,
 workPath:typeof saved.workPath==='string'&&saved.workPath.startsWith('/posao/')?saved.workPath:null,
 sidebar:['open','compact'].includes(String(saved.sidebar))?saved.sidebar!:'auto',fullscreen:false,
 remember:(jobId,workPath)=>set({jobId,workPath}),clearJob:()=>set({jobId:null,workPath:null}),
 toggleSidebar:compact=>set({sidebar:compact?'open':'compact'}),setFullscreen:fullscreen=>set({fullscreen}),
}));
useNavigation.subscribe(({jobId,workPath,sidebar})=>{try{sessionStorage.setItem('alu-navigation-v1',JSON.stringify({jobId,workPath,sidebar}));}catch{/* Preferences are optional. */}});
