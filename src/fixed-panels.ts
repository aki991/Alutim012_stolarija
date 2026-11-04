export const panelLabels = {
 top:'Fiksno gore', bottom:'Fiksno dole', left:'Fiksno levo', right:'Fiksno desno',
} as const;

export type PanelSide = keyof typeof panelLabels;
export type FixedPanels = Record<PanelSide, number>;
export const noPanels: FixedPanels = {top:0,bottom:0,left:0,right:0};

export function centralWidth(width:number, panels?:FixedPanels) {
 return width-(panels?.left??0)-(panels?.right??0);
}
