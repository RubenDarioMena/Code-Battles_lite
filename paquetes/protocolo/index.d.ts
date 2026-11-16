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

/** Contrato de dibujo: admite instantáneas o escenas visibles del reglamento. */
export interface Vista {
  /** Extrapola actual fraccion × dt; anterior puede ser null. ahora es la marca opcional del fotograma en ms. */
  dibujar(anterior: Readonly<Record<string, any>> | null, actual: Readonly<Record<string, any>>, fraccion: number, ahora?: number): void;
  alSuceso(suceso: Suceso): void;
  elegir(x: number, y: number): string | null;
  /** radioPlano desplaza solo la etiqueta 2D hacia arriba, en unidades del mundo. */
  proyectar(x: number, alto: number, y: number, radioPlano?: number): { x: number; y: number; visible: boolean };
  redimensionar(): void;
  destruir(): void;
}
