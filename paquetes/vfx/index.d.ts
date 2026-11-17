import type { Suceso } from '../protocolo/index.js';
export type Calidad = 'alto' | 'medio' | 'bajo' | 'no';
export type Intervalo = number | [number, number];
export type RGB = [number, number, number];
export interface Capa {
  forma: 'brillo' | 'disco' | 'humo';
  mezcla: 'normal' | 'suma';
  n: Intervalo;
  vida: Intervalo;
  retraso?: Intervalo;
  dir?: 'esfera' | 'hemisferio' | 'cono' | 'anillo' | 'arriba';
  vel?: Intervalo;
  arrastre?: number;
  grav?: number;
  deriva?: RGB;
  suelo?: boolean;
  alto?: number;
  adelante?: number;
  /** Radio estable del aro; no es velocidad. */
  radioFinal?: number;
  tam: number[];
  alfa: number[];
  color: string[];
  estela?: number;
  /** Reservado; no produce bucles en este paso. */
  ciclo?: number;
}
export interface Receta { capas: Capa[] }
/** datos.origen=[x,y,z] y datos.rumbo (radianes) son enriquecimiento visual opcional.
 * Sin origen se usa datos.x/y/z; disparo necesita origen porque x/y es el destino. */
export interface Particula {
  x: number; y: number; z: number; tam: number; alfa: number;
  color: RGB; forma: Capa['forma']; mezcla: Capa['mezcla'];
  paso: number; capa: number; indice: number; estela: number;
}
export interface OpcionesEvaluar {
  dt: number;
  /** Tokens resueltos a hex #RGB/#RRGGBB o RGB normalizado [0,1]. */
  colores?: Record<string, string | RGB>;
  calidad?: Calidad;
}
export interface OpcionesEfectos {
  recetas: Record<string, Receta>;
  recetaDe: (suceso: Suceso) => string | null | undefined;
  dt: number;
  presupuesto?: number | Partial<Record<Calidad, number>>;
}
export function validarReceta(receta: unknown): string[];
export function evaluar(suceso: Suceso, receta: Receta, tv: number, opciones: OpcionesEvaluar, emitir: (p: Particula) => void): void;
export function crearEfectos(opciones: OpcionesEfectos): {
  anotar(suceso: Suceso): void;
  vaciar(): void;
  /** Poda definitiva: para rebobinar tras caducar, vaciar y volver a anotar. */
  particulas(tv: number, opciones?: Omit<OpcionesEvaluar, 'dt'>, emitir?: (p: Particula) => void): Particula[];
};
export const PRESUPUESTOS: Readonly<Record<Calidad, number>>;
export function crearRecetasWar(opciones: { radioDanio: number }): Record<string, Receta>;
export function recetaWar(suceso: Suceso): string | null;
