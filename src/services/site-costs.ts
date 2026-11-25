import type { Job } from '../models';

export type SiteCosts={installation?:number;travel?:number};
export const siteTravel=(job:Job)=>job.siteCosts?.travel??job.transport;
export const hasInstallationTotal=(job:Job)=>job.siteCosts?.installation!==undefined;
export function isSiteCosts(value:unknown):value is SiteCosts{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 return Object.entries(value).every(([key,amount])=>['installation','travel'].includes(key)&&typeof amount==='number'&&Number.isFinite(amount)&&amount>=0&&amount<=1e8);
}

/** Equal shares per piece, with any remaining cents assigned in stable element order. */
export function spreadSiteCosts(cents:number,quantities:number[]){
 const counts=quantities.map(q=>Number.isInteger(q)&&q>0&&q<=100?q:0),count=counts.reduce((a,b)=>a+b,0);
 let remainder=count?cents%count:0;
 const perPiece=count?Math.floor(cents/count):0;
 const shares=counts.map(q=>{const extra=Math.min(remainder,q);remainder-=extra;return perPiece*q+extra;});
 return {shares,unallocated:count?0:cents};
}
