/** Funciones que el Worker recibe por su texto: deben ser autocontenidas. */
export interface PiezasTrabajador {
  validarFactory?: Function | string | null;
  validarCampaign?: Function | string | null;
  modoCampaign?: Function | string | null;
  capacidades?: Record<string, { api: Function; ordenar: Function }>;
  lugarDeObjetivo?: Function | string;
  preludioPython?: Function | string | null;
}
/** Canal mínimo de un programa: un Worker del navegador o su imitación sin pantalla. */
export interface Trabajador { postMessage(mensaje: unknown): void; terminate(): void }
export interface Programa {
  id: string;
  worker: Trabajador;
  estado: string;
  desde: number;
  mensajes: number;
  espera: number | null;
  despertar: number;
  pend: Map<number, { tipo: string; despertar?: number; [clave: string]: unknown }>;
  [clave: string]: unknown;
}
export interface Ejecucion { progs: Map<string, Programa>; [clave: string]: unknown }
export interface MundoReloj { t: number }

export function fuenteTrabajador(piezas?: PiezasTrabajador): string;

export interface Turno {
  ordenes: import('../protocolo/index.js').Orden[];
  /** Mensajes del Worker en orden fijo (unidad, llegada), con la unidad que los envió. */
  avisos: Array<{ unidad: string; type: string; [clave: string]: unknown }>;
  error: { unidad: string; mensaje: string; linea: number | null; motivo?: string } | null;
}
export interface PausaUnidad { unidad: string; linea: number }
export type AvanceLinea = PausaUnidad | { unidad: string; finTurno: true } | null;
export interface OpcionesAnfitrion {
  reglas: { id: string; api?: any };
  crearTrabajador(fuente: string, unidad: string, recibir: (mensaje: any) => void, maxOrdenes?: number,
    opciones?: { depurar?: boolean }): Trabajador & { entregar?(): boolean; pausa?(): { linea: number } | null; reanudar?(): unknown; onerror?: any };
  pasoAPaso?: boolean;
  eventos?: string[];
  erroresEvento?: { tarde: string; funcion: string };
  aislarErrores?: boolean;
  contexto?: { nombres?: string[]; tipos?: string[]; sensores?: string[]; conf?: Record<string, number> };
  piezas?: PiezasTrabajador;
  maxOrdenes?: number;
  ahora?: () => number;
}
export interface OpcionesPrograma {
  lenguaje?: 'js' | 'python';
  diagnostico?: { mensaje: string; linea: number | null };
}
export interface Anfitrion {
  escucha(unidad: string, evento: string): boolean;
  entregarEventos(snap: { t: number }, eventos: import('../nucleo/index.js').EventoPrograma[]): Promise<Turno>;
  pausas(): PausaUnidad[];
  avanzarLinea(unidad?: string): Promise<AvanceLinea>;
  continuar(): Promise<void>;
  cargar(unidad: string, codigo: string, opciones?: OpcionesPrograma): Promise<void>;
  recargar(unidad: string, codigo: string, opciones?: OpcionesPrograma): Promise<void>;
  ceder(instantanea: { t: number; [clave: string]: unknown }, respuestas?: import('../nucleo/index.js').Respuesta[]): Promise<Turno>;
  responder(respuestas: import('../nucleo/index.js').Respuesta[]): Promise<Turno>;
  /** Índice absoluto de eventos; los contadores siempre son acumulados. Devuelve una copia. */
  registro(opciones?: { desde?: number }): { eventos: any[]; verbos?: Record<string, number>; resultados?: Record<string, number>;
    uso?: Record<string, Record<string, number>>; consolas: Record<string, number>; lecturas?: Record<string, number> };
  vigilar(ahora: number, ms: number, mensaje: (unidad: string) => string): string | null;
  algunoCorre(): boolean;
  /** Fallo anotado (también uno llegado después de cerrar su turno) o null. */
  fallo(): { unidad: string; mensaje: string; linea: number | null; motivo?: string } | null;
  estado(unidad: string): string | null;
  proximaEspera(): number | null;
  detener(respuestas?: import('../nucleo/index.js').Respuesta[]): void;
}
export function crearAnfitrion(opciones: OpcionesAnfitrion): Anfitrion;

export interface OpcionesTrabajadorInterprete {
  depurar?: boolean;
  /** Piezas como funciones nativas; sin ellas se recuperan del generador de fuente. */
  piezas?: PiezasTrabajador;
  acorn: import('../interprete/index.js').Analizador;
  /** Nodos por tarea entregada, incluida su cola de trabajos. Por defecto PRESUPUESTO (1 000 000); la API de confianza no se interpreta. */
  presupuesto?: number;
  mensajePresupuesto?: (unidad: string) => string;
}
export interface TrabajadorInterprete extends Trabajador {
  entregar(): boolean;
  pausa(): { linea: number } | null;
  reanudar(): { linea: number } | null;
  medir(): import('../interprete/index.js').Medida;
}
/** Presupuesto por defecto de cada tarea entregada (nodos y llamadas nativas). */
export const PRESUPUESTO: number;
export function crearTrabajadorInterprete(opciones: OpcionesTrabajadorInterprete):
  (fuente: string, unidad: string, recibir: (mensaje: any) => void, maxOrdenes?: number, opciones?: { depurar?: boolean }) => TrabajadorInterprete;
