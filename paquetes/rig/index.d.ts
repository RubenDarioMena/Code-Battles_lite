export interface Control {
  nombre: string;
  unidad: 'm' | 'rad' | 'factor';
  reposo: number;
  min?: number;
  max?: number;
  ciclico?: boolean;
}
export type Expresion = number | string | [string, ...Expresion[]];
export interface Local {
  tipo: 'LOCAL';
  base: { t: number[]; r: number[]; s: number[] };
  traslacion: Expresion[];
  rotaciones: {eje: number[]; angulo: Expresion}[];
  escala: Expresion[];
}
export type Restriccion = { objetivo: string; influencia: number } & (
  { tipo: 'APUNTAR'; eje: number[] } |
  { tipo: 'APUNTAR_BLOQUEADO'; eje: number[]; bloqueo: number[] } |
  { tipo: 'COPIAR_POSICION'; ejes: boolean[]; invertir: boolean[]; desplazamiento: boolean } |
  { tipo: 'ESTIRAR'; longitud_reposo: number; volumen: 'NO'|'X'|'Z'|'XZ'; abultamiento: number; eje_fijo: 'Y'|'Z' }
);
export interface Pivote {
  nombre: string; padre: string | null;
  t: number[]; r: number[]; s: number[]; reposo: Float64Array;
  reglas: (Local | Restriccion)[];
}
export interface Nivel {
  raiz: string; orden: string[]; controles: Control[]; pivotes: Record<string,Pivote>;
  bucle?: {fps: number; cuadros: number; claves: ({cuadro: number} & Record<string,number>)[]};
}
export interface Rig { niveles: Nivel[] }
export interface Pose { mundo: Record<string,Float64Array>; locales: Record<string,Float64Array> }
export function leerRig(gltfJson: {nodes: any[]; scenes: {nodes: number[]}[]; scene?: number}): Rig;
export function crearSolver(rig: Rig, nivel: number): {
  controles: Control[]; evaluar(valores?: Record<string,number>): Pose;
};
