import type { Instantanea, Orden, Suceso } from '../protocolo/index.js';
import type { Reglamento, Partida } from '../nucleo/index.js';
import type { Anfitrion, Turno } from '../anfitrion/index.js';

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
export interface OpcionesConductor {
  reglas: Reglamento<any, any, any>;
  partida: Partida<any, any, any>;
  detener?: (partida: Partida<any, any, any>) => boolean;
  anfitrion?: Anfitrion | null;
  vista?: Vista;
  /** Número de pasos desde el inicio de este conductor. */
  alPaso?: (paso: number, instantanea: Instantanea, partida: Partida<any, any, any>) => void;
  /** Sucesos iniciales y los nuevos tras cada paso, también si la lista está vacía. */
  alSucesos?: (sucesos: Suceso[]) => void;
  alTurno?: (turno: Turno) => void;
}
export interface Conductor {
  iniciar(): Promise<void>;
  avanzar(maxPasos: number): Promise<{ pasos: number; terminada: boolean }>;
  readonly error: Turno['error'];
  readonly terminada: boolean;
  cerrar(): void;
}
export interface OpcionesJugar extends Omit<OpcionesConductor, 'partida'> {
  /** Necesarios al crear; se omiten si se continúa una partida. */
  escenario?: any;
  semilla?: number;
  partida?: Partida<any, any, any>;
  ordenes?: Orden[];
  maxPasos?: number;
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
export function crearConductor(opciones: OpcionesConductor): Conductor;
export function jugarPartida(opciones: OpcionesJugar): Promise<ResultadoJugar>;
