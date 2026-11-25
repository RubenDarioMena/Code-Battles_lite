import type { DatoPlano, Orden, Instantanea } from '../protocolo/index.js';
import type { Rng, RegistroSucesos, Reglamento } from '../nucleo/index.js';

export type TipoEnemigo = 'crawler' | 'drone' | 'stealth';
export type TipoSensor = 'visual' | 'thermal';
export type Lugar = { x: number; y: number; z?: number; id?: string; tipo?: TipoEnemigo };
export type Reto = {
  titulo: string; objetivo: string; leccion: string; pista: string;
  lanzadores: { id: string; x: number; y: number }[];
  sensores: { id: string; x: number; y: number; alcance: number }[];
  reparadores: number; cargador: number; suministro: number; niebla: boolean;
  oleadas: { tipo: TipoEnemigo; n: number; t: number; cada: number; carriles: number[]; hp?: number; vel?: number }[];
  metas: { brechasMax: number; atascosMax?: number; derribosMin?: number; tiempoMax?: number };
  inicial: { [unidad: string]: string[] };
  mapa?: { cols: number };
};
export type Escenario = { reto: Reto };
export interface Final { fin: string; motivo: string | null; mensaje: string | null }
export interface Estadisticas {
  consumidos?: number; lanzados?: number; impactos?: number; derribos?: number;
  atascos?: number; tRafaga?: number; fallaMax?: number; lecturas?: number; reparaciones?: number;
}
export interface Maquina {
  id: string; clase: string; cx: number; cy: number; st?: Estadisticas;
  modo?: string; lugar?: Lugar | null; cd?: number; misiles?: number; carga?: number; suministro?: number;
  falla?: number; riesgo?: number; umbral?: number; tReparar?: number;
  atascado?: boolean; yaw?: number; sinMisiles?: boolean; alcance?: number;
  bx?: number; by?: number; estado?: string; objetivo?: string | null; t?: number;
}
export interface Enemigo {
  id: string; tipo: TipoEnemigo; x: number; y: number; z: number;
  vx: number; vy: number; hp: number; hpMax: number; golpeT: number;
  fuera?: boolean; muerto?: boolean;
}
export interface Misil {
  id: number; de: string; x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number; t0: number; dur: number;
  objetivo: string | null; arco: number; hecho?: boolean;
}
export interface Mundo {
  def: Reto; semilla: number | null; rng: Rng; t: number; activo: boolean;
  fin: string | null; final?: Final; sucesos?: RegistroSucesos;
  programables: Maquina[]; lanzadores: Maquina[]; sensores: Maquina[];
  deposito: Maquina; reparadores: Maquina[]; maquinas: Maquina[];
  porId: { [unidad: string]: Maquina }; colaReparar: string[];
  pendientes: { id?: string; tipo: TipoEnemigo; nace: number; y: number; hp: number; vel: number; orden: number }[];
  enemigos: Enemigo[]; misiles: Misil[]; sigMisil: number;
  explosiones: { x: number; y: number; z: number; t0: number; atasco?: boolean; golpe?: boolean }[];
  derribados: { x: number; y: number; z: number; t0: number; tipo: TipoEnemigo }[];
  brechas: number; derribos: number; consumidos: number; impactos: number;
  atascos: number; reparaciones: number; total: number;
  detalleAtascos: { t: number; id: string; falla: number; tReparar: number }[];
  eventos: DatoPlano[]; uso: { [unidad: string]: { [nombre: string]: number } };
  consolas: { log: number; info: number; warn: number; error: number };
}
export interface Ganchos {
  registrar(maquina: string, linea: number | null, que: string, resultado: string, clase: string): void;
  terminar(fin: string, motivo: string | null, mensaje: string | null): void;
  avisoSistema(mensaje: string): void;
  globo(unidad: string, origen: string, mensaje: string): void;
}
export type Objetivo = Lugar & { z: number; id: string; tipo: TipoEnemigo };
export interface InstantaneaWar extends Instantanea {
  auto: { [unidad: string]: { [sensor in TipoSensor]: { [tipo in TipoEnemigo]: Objetivo | null } } };
}
export interface Conexion {
  paso(dt: number): void; evaluar(): void; instantanea(): InstantaneaWar;
  alcance(sensor: TipoSensor): number; enRango(sensor: Maquina): Enemigo[]; coste(): number;
}
export interface ReglamentoWar extends Reglamento<Mundo, Escenario, Final | null> {
  id: 'war'; version: 1;
  instantanea(mundo: Mundo): InstantaneaWar;
  /** Lo que dibujan las vistas: datos planos independientes del mundo (fase 2). */
  escena(mundo: Mundo): { t: number; porId: Record<string, any>; [clave: string]: any };
  api: {
    ordenes: string[];
    tipos: { [tipo: string]: { nombre: string; suelo: boolean; z: number; vel: number; hp: number; frio: boolean; letra: string } };
    sensores: { [sensor: string]: { nombre: string; alcance: number; niebla: number } };
    conf: { fallaRafaga: number; cadencia: number; cadenciaRafaga: number };
  };
}
export function fijarSuministro(lanzador: Maquina, ritmo: number): void;
export function crear(def: Reto, semilla: number | null, rng?: Rng): Mundo;
export function aplicarOrden(mundo: Mundo, orden: Orden): void;
export const TIPOS: ReglamentoWar['api']['tipos'];
export const SENSOR: ReglamentoWar['api']['sensores'];
export const LAU: { cadencia: number; cadenciaRafaga: number; cargador: number; suministro: number; fallaBase: number; fallaRafaga: number; subida: number; bajada: number; bajadaParado: number };
export const MISIL: { vel: number; radio: number };
export const REP: { vel: number; tBase: number; tPorFallo: number };
export const COSTE: { misil: number; reparacion: number };
export function cadencia(modo: string): number;
export const retos: {
  RETOS: Partial<Reto>[]; PROPIO_BASE: Partial<Reto>;
  POS_LANZADORES: { [cantidad: number]: Reto['lanzadores'] };
  normalizar(def: Partial<Reto>): Reto;
};
declare const reglamento: ReglamentoWar;
export default reglamento;

export function pasoConIntentoPuntual(mundo: Mundo, dt: number, pendientes: Map<string, Lugar>, descartar: (id: string, motivo: string) => void): void;
export function leerEnemigos(mundo: Mundo): Mundo['enemigos'];
export function danoEnArea(mundo: Mundo, x: number, y: number, radio: number, dano: number, por?: string | null): string[];
