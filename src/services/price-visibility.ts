export function teamPriceVisibility(role:'manager'|'worker',personal:boolean|undefined,ready:boolean,workerPricesVisible:boolean|null){
 return ready&&personal!==false&&(role!=='worker'||workerPricesVisible===true);
}
