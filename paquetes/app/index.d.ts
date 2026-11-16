import type { Instantanea, Orden, Suceso } from '../protocolo/index.js';
import type { Reglamento, Partida } from '../nucleo/index.js';
import type { Anfitrion } from '../anfitrion/index.js';

export interface Vista {
  dibujar(anterior: Instantanea, actual: Instantanea, fraccion: number): void;
  alSuceso(suceso: Suceso): void;
  elegir(x: number, y: number): string | null;
  redimensionar(): void;
  destruir(): void;
}
export interface VistaNula extends Vista {
  resumen(): { fotogramas: number; sucesos: number; t: number | null };
}
export interface OpcionesJugar {
  reglas: Reglamento<any, any, any>;
  escenario: any;
  semilla: number;
  anfitrion?: Anfitrion | null;
  vista?: Vista;
  ordenes?: Orden[];
  maxPasos?: number;
  alPaso?: (paso: number, instantanea: Instantanea, partida: Partida<any, any, any>) => void;
}
export interface ResultadoJugar {
  partida: Partida<any, any, any>;
  pasos: number;
  error: { unidad: string; mensaje: string; linea: number | null; motivo?: string } | null;
  limite: boolean;
  evaluacion: any;
  instantanea: Instantanea;
}
export function crearVistaNula(): VistaNula;
export function jugarPartida(opciones: OpcionesJugar): Promise<ResultadoJugar>;
