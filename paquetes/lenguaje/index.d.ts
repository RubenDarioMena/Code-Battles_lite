/** Todos los analizadores externos se reciben explícitamente; ningún acceso al navegador. */
export interface AnalizadorJS { parse(texto: string, opciones?: object): any }
export interface AnalizadorPython { parser: { parse(texto: string): any } }
export type FichaLexica = [tipo: string, texto: string];
export const NOMBRES_HUECO: string;
export const HUECO: RegExp;
export const RE_HUECO: RegExp;
export function lexico(texto: string): FichaLexica[];
export interface PuertoTexto {
  value: string; readOnly: boolean; selectionStart: number; selectionEnd: number;
  setSelectionRange(desde: number, hasta: number): void;
}
export const CMGEditorJS: {
  NOMBRES_HUECO: string; HUECO: RegExp; RE_HUECO: RegExp; lexico: typeof lexico;
  crearEdicion(opciones: {
    codigo: PuertoTexto;
    insertar(texto: string, desde?: number, hasta?: number): boolean | void;
    aviso(mensaje: string): void;
    escapar(valor: unknown): string;
    estructura(): typeof ESTRUCTURA | null;
  }): {
    rangoCodigo(pos: number, triple?: boolean): number[] | null;
    envolver(antes: string, despues: string, bloque?: boolean): boolean | void;
    expresionEnvolvible(): { a: number; b: number; puntoYComa: boolean } | null;
    elegirLineasCompletas(): void;
    insertarBloque(bloque: string, envolvente?: string[]): void;
    insertarOperador(accion: { operador: string; hueco?: string; prefijo?: boolean }): boolean | void;
  };
};
/** Árbol tolerante, con offsets UTF-16, padres y delimitadores propios de cada nodo. */
import { ESTRUCTURA } from './estructura.js';
export { ESTRUCTURA };
export interface AliasPython { objeto?: string | null; nombre: string; destino: string; await?: boolean }
export interface OpcionesPython {
  funciones?: AliasPython[]; objetos?: string[]; propiedades?: string[];
  hueco?: (nombre: string) => string | null;
}
export interface Diagnostico { linea: number | null; columna?: number | null; mensaje: string }
export interface Traduccion { ok: boolean; js: string; diagnosticos: Diagnostico[] }
export interface TraductorPython {
  traducir(texto: string, opciones?: OpcionesPython): Traduccion;
  /** Cache por texto e identidad de opciones, aislada en cada instancia. */
  traducirCache(texto: string, opciones?: OpcionesPython): Traduccion;
  preludio: typeof preludio;
}
export function crearPython(dependencias?: {
  lezer?: AnalizadorPython;
  hueco?: (nombre: string) => string | null;
}): TraductorPython;
/** Sin analizador por defecto: devuelve el diagnóstico de analizador ausente. */
export const CMGPythonJS: TraductorPython;
/** Autónoma y serializable con toString(): pieza que recibe anfitrion para su Worker. */
export function preludio(): Record<string, any>;
export interface OpcionesConversion {
  acorn?: AnalizadorJS; nombres?: Map<string, string>; objetoONulo?: string[];
  huecos?: { re: RegExp; aPython(nombre: string): string };
}
export interface ConversorPython {
  convertir(texto: string, opciones?: OpcionesConversion):
    { ok: boolean; texto?: string; motivo?: string; linea?: number | null };
}
export function crearJSaPython(dependencias?: { acorn?: AnalizadorJS }): ConversorPython;
export const CMGJSaPython: ConversorPython;
export function vocabulario(serie?: string): {
  KW: Set<string>; FN_PROPIAS: Set<string>; FN_MIEMBRO: Set<string>; PROPS: Set<string>;
};
export function vecino(fichas: FichaLexica[], indice: number, direccion: number): FichaLexica | null;
export function instrumentar(texto: string, opciones?: {
  funciones?: Set<string>;
  serie?: string; objetos?: string[]; acorn?: AnalizadorJS;
}): string;
export function revisar(texto: string, acorn?: AnalizadorJS): Diagnostico | null;
export function opcionesPython(objetos: string[], funciones: AliasPython[], propiedades: Iterable<string>): OpcionesPython;
export function mensajePython(mensaje: unknown, nombres: Iterable<[string, string]>): string;
export function fmtLugar(lugar: { x: number; y: number; z?: number; id?: string } | null): string;
export function fmtValor(valor: unknown): string;
