export type Origen = 'programa' | 'jugador' | 'sistema';
export type DatoPlano = null | boolean | string | number | DatoPlano[] | { [clave: string]: DatoPlano };

export interface Orden {
  paso: number;
  origen: Origen;
  unidad: string;
  verbo: string;
  args: DatoPlano[];
  /** Referencia del emisor; el reglamento la devuelve en la respuesta. */
  ref?: string;
}

export interface Suceso {
  paso: number;
  tipo: string;
  unidad?: string;
  datos?: { [clave: string]: DatoPlano };
}

export interface Instantanea {
  t: number;
  [clave: string]: DatoPlano;
}

export const ORIGENES: readonly Origen[];
export function esDatoPlano(valor: unknown): valor is DatoPlano;
export function validarOrden(o: unknown): string[];
export function validarSuceso(s: unknown): string[];
export function validarInstantanea(i: unknown): string[];
export function canonico(valor: unknown): string;
