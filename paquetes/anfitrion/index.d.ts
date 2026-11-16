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

