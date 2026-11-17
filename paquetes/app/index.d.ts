import type { Instantanea, Orden, Suceso } from '../protocolo/index.js';
import type { Reglamento, Partida } from '../nucleo/index.js';
import type { Anfitrion, Turno } from '../anfitrion/index.js';

import type { Vista } from '../protocolo/index.js';
export type { Vista } from '../protocolo/index.js';

/** Texto sin codificación ni prefijos añadidos. Los fallos de almacenamiento no se propagan. */
export interface Almacen {
  leer(clave: string): string | null;
  escribir(clave: string, texto: string): void;
  borrar(clave: string): void;
}
/** Interfaz síncrona: escritorio precargará el guardado y persistirá por detrás. */
export interface Plataforma {
  almacen: Almacen;
  sesion: Almacen;
  /** Opcional; la cáscara absorbe los fallos del servicio. */
  logros?: { desbloquear(id: string): void };
}
export function crearPlataformaMemoria(): Plataforma;

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
  reanudar(): void;
  /** Promesa del turno que sigue esperando a los programas, o null. */
  turnoPendiente(): Promise<void> | null;
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

/** Instaladores de la composición en vivo; no acceden al navegador al importar. */
export function instalarCicloProgramas(ctx: any): ReturnType<typeof import('./juego/ciclo-programas.js').instalarCicloProgramas>;
export function instalarCierreIntentos(ctx: any): ReturnType<typeof import('./juego/cierre-intentos.js').instalarCierreIntentos>;
export function instalarBucleJuego(ctx: any): ReturnType<typeof import('./juego/bucle.js').instalarBucleJuego>;

/** Plataforma y proveedores clásicos de la página para la composición. */
export interface OpcionesArranqueJuego {
  /** Sin plataforma se usan almacenes aislados en memoria. */
  plataforma?: Plataforma;
  servicios?: {
    CMGI18n?: any; CMGPresentacion?: any; CMGTerreno?: any;
    CMGTrazador?: any; CMGFlujo?: any; CMGPythonRevision?: any;
    THREE?: any; acorn?: any; LezerPython?: any;
    cargarRevision?: () => Promise<{ catalogo: any; revision: any; trazador: any; python: any }>;
  };
}
/** Instala la aplicación en el DOM existente y publica __banco, cmg y __juegoListo. */
export function arrancarJuego(opciones?: OpcionesArranqueJuego): void;
export { CMGProveedor } from './juego/datos-proveedor.js';
export { CMGPaleta } from './juego/paleta.js';
export { CMGProgramas } from './juego/aplicar-programas.js';
