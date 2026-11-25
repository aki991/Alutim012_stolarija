export function matchesTextSearch(query:string,...values:string[]){
 const normalize=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[đĐ]/g,'dj').toLowerCase();
 const text=normalize(values.join(' '));
 return normalize(query).trim().split(/\s+/).every(word=>text.includes(word));
}
