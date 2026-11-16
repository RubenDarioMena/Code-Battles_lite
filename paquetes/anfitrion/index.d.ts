/** Funciones que el Worker recibe por su texto: deben ser autocontenidas. */
export interface PiezasTrabajador {
  validarFactory?: Function | string | null;
  validarCampaign?: Function | string | null;
  modoCampaign?: Function | string | null;
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
export function algunoCorre(ejec: Ejecucion | null | undefined): boolean;
export function despertar(ejec: Ejecucion | null | undefined, mundo: MundoReloj, instantanea: () => unknown, ahora?: () => number): boolean;
export function despertarCampaign(ejec: Ejecucion | null | undefined, mundo: MundoReloj, instantanea: () => unknown, ahora?: () => number): boolean;

export interface Turno {
  ordenes: import('../protocolo/index.js').Orden[];
  /** Mensajes del Worker en orden fijo (unidad, llegada), con la unidad que los envió. */
  avisos: Array<{ unidad: string; type: string; [clave: string]: unknown }>;
  error: { unidad: string; mensaje: string; linea: number | null; motivo?: string } | null;
}
export interface OpcionesAnfitrion {
  reglas: { id: string; api?: any };
  crearTrabajador(fuente: string, unidad: string, recibir: (mensaje: any) => void): Trabajador & { entregar?(): boolean; onerror?: any };
  contexto?: { nombres?: string[]; tipos?: string[]; sensores?: string[]; conf?: Record<string, number> };
  piezas?: PiezasTrabajador;
  maxOrdenes?: number;
  ahora?: () => number;
}
export interface Anfitrion {
  cargar(unidad: string, codigo: string, opciones?: { lenguaje?: 'js' | 'python' }): Promise<void>;
  ceder(instantanea: { t: number; [clave: string]: unknown }, respuestas?: import('../nucleo/index.js').Respuesta[]): Promise<Turno>;
  responder(respuestas: import('../nucleo/index.js').Respuesta[]): Promise<Turno>;
  registro(): { eventos: any[]; verbos?: Record<string, number>; resultados?: Record<string, number>;
    uso?: Record<string, Record<string, number>>; consolas: Record<string, number> };
  algunoCorre(): boolean;
  estado(unidad: string): string | null;
  proximaEspera(): number | null;
  detener(respuestas?: import('../nucleo/index.js').Respuesta[]): void;
}
export function crearAnfitrion(opciones: OpcionesAnfitrion): Anfitrion;
