export function teamPriceVisibility(role:'manager'|'worker'|'salon',personal:boolean|undefined,ready:boolean,workerPricesVisible:boolean|null){
 return role!=='salon'&&ready&&personal!==false&&(role!=='worker'||workerPricesVisible===true);
}
