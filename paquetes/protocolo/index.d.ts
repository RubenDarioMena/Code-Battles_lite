export type Origen = 'programa' | 'jugador' | 'sistema';
export type DatoPlano = null | boolean | string | number | DatoPlano[] | { [clave: string]: DatoPlano };

export interface Orden {
  paso: number;
  origen: Origen;
  unidad: string;
  verbo: string;
  args: DatoPlano[];
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
