export interface JobOrigin {
 created_by?:string|null;
 assigned_by:string|null;
 created_by_name?:string|null;
 assigned_by_name?:string|null;
 assigned_to_name?:string|null;
 can_reassign?:boolean;
}

export function canChangeAssignment(member:{id:string;role:'manager'|'worker'|'salon'}|null,origin?:JobOrigin){
 if(member?.role!=='manager'||!origin)return false;
 if(typeof origin.can_reassign==='boolean')return origin.can_reassign;
 return origin.assigned_by===member.id||origin.assigned_by===null&&origin.created_by===member.id;
}
