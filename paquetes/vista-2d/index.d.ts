import type { Vista } from '../protocolo/index.js';
export type { Vista } from '../protocolo/index.js';
export { crearPlano } from './war.js';
export { dibujarFactory } from './factory.js';
export { crearPlanoCampaign } from './campaign.js';
export { crearTerreno } from './campaign-terreno.js';

export interface EstadoVista2D {
  readonly escena: Readonly<Record<string, any>> | null;
  readonly seleccion?: string | null;
  readonly seleccionadas?: ReadonlySet<string>;
  readonly arrastreCampo?: any;
  readonly cols: number;
  readonly rows: number;
  readonly col: Record<string, string>;
}
export interface OpcionesVista2D {
  serie: 'war' | 'factory' | 'campaign';
  /** Paso fijo en segundos; off = fraccion × dt. */
  dt: number;
  estado?: EstadoVista2D;
  cols?: number;
  rows?: number;
  tema?: Record<string, string>;
  calidad?: string;
  /** Catálogos y funciones del plano de la serie, inyectados por la composición. */
  [dependencia: string]: any;
}
export interface Vista2D extends Vista {
  suelo(x: number, y: number): { x: number; y: number; z: number };
}
export function crearVista(contenedor: HTMLCanvasElement, opciones: OpcionesVista2D): Vista2D;

export { crearDibujanteEfectos } from './efectos.js';
