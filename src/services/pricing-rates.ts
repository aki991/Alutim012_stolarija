export const supplementRates={
 // Keep the old area-based rates readable in saved price lists and backups.
 pvc76:125, pvc82:145, aluCold:135,
 pvc70Frame:15, pvc70Sash:18, pvc76Frame:17, pvc76Sash:20.5, pvc82Frame:20, pvc82Sash:23.5,
 aluThermalFrame:24, aluThermalSash:28.5, aluColdFrame:18, aluColdSash:22.5,
 doorHardware:45, secureDoorHardware:75,
 profileColor:15, panel:65, louvres:85, divider:22, bendPVC:48, bendALU:78, shapedInfill:40, service:30,
 tiltHardware:12, slideHardware:45, foldHardware:58, pivotHardware:65, specialHardware:25,
 liftSlide:150, tiltSlide:95, retractSlide:110, multiTrack:75, pocket:65,
 motor:280, automaticDoor:650, revolvingDoor:1600, garageMechanism:210, certifiedDoor:180,
} as const;

export type SupplementRate=keyof typeof supplementRates;

export const profileRateKeys={
 'PVC 70 mm':['pvc70Frame','pvc70Sash'],
 'PVC 76 mm':['pvc76Frame','pvc76Sash'],
 'PVC 82 mm':['pvc82Frame','pvc82Sash'],
 'ALU termo profil':['aluThermalFrame','aluThermalSash'],
 'ALU hladni profil':['aluColdFrame','aluColdSash'],
} as const;

export const supplementLabels:Record<SupplementRate,[name:string,unit:string]>={
 pvc76:['PVC profil 76 mm','m²'],pvc82:['PVC profil 82 mm','m²'],aluCold:['ALU hladni profil','m²'],profileColor:['Doplata za boju profila','%'],
 pvc70Frame:['PVC ram 70 mm','m'],pvc70Sash:['PVC krilo 70 mm','m'],
 pvc76Frame:['PVC ram 76 mm','m'],pvc76Sash:['PVC krilo 76 mm','m'],
 pvc82Frame:['PVC ram 82 mm','m'],pvc82Sash:['PVC krilo 82 mm','m'],
 aluThermalFrame:['ALU termo ram','m'],aluThermalSash:['ALU termo krilo','m'],
 aluColdFrame:['ALU hladni ram','m'],aluColdSash:['ALU hladno krilo','m'],
 doorHardware:['Standardni okov za vrata','krilo'],secureDoorHardware:['Sigurnosni okov za vrata','krilo'],
 panel:['Puni panel','m²'],louvres:['Lamele','m²'],divider:['Prečka','m'],
 bendPVC:['Savijanje PVC profila','m luka'],bendALU:['Savijanje ALU profila','m luka'],shapedInfill:['Obrada nestandardne ispune','kom'],service:['Osnovna usluga','kom'],
 tiltHardware:['Doplata za kip / zaokretno-otklopni okov','krilo'],slideHardware:['Doplata za klizni okov','krilo'],foldHardware:['Doplata za sklopivi okov','krilo'],pivotHardware:['Doplata za pivot okov','krilo'],specialHardware:['Doplata za izbačajni, lamelski i specijalni okov','krilo'],
 liftSlide:['Podizno-klizni mehanizam (HS)','sistem'],tiltSlide:['Otklopno-klizni mehanizam (PSK)','sistem'],retractSlide:['Odmično-klizni mehanizam','sistem'],multiTrack:['Teleskopske i višekanalne vođice','sistem'],pocket:['Klizanje u zidni džep','sistem'],
 motor:['Motorni pogon','sistem'],automaticDoor:['Automatika i senzori vrata','sistem'],revolvingDoor:['Mehanizam rotirajućih vrata','sistem'],garageMechanism:['Mehanizam garažnih i industrijskih vrata','sistem'],certifiedDoor:['Poseban okov za protivpožarna, sigurnosna ili antipanik vrata','sistem'],
};
