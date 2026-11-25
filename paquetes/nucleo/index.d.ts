import type { DatoPlano, Orden, Suceso, Instantanea } from '../protocolo/index.js';

export type Rng = () => number;
export interface RelojMundo { activo: boolean; fin: unknown }
export interface ControlAvance {
  algunoCorre(): boolean;
  despertarProgramas(): boolean;
  paso(dt: number): void;
}
export interface ColaOrdenes {
  poner(orden: Orden): void;
  tomar(paso: number): Orden[];
  pendientes(): Orden[];
}
export interface RegistroSucesos {
  anotar(suceso: Suceso): void;
  desde(paso: number): Suceso[];
  vaciar(): void;
}
export interface MundoConSucesos { t: number; sucesos?: RegistroSucesos }
/** Respuesta de un encargo; la instantánea se toma al terminarlo, incluso a mitad de paso. */
export type Respuesta = { unidad: string; resultado: string; ref?: string } &
  ({ modo: true; instantanea?: never } | { modo?: false; instantanea: Instantanea });
export interface EventoPrograma { evento: string; unidad: string; datos: DatoPlano }
export interface Reglamento<Mundo, Escenario, Evaluacion = DatoPlano> {
  id: string;
  version: string | number;
  crearMundo(escenario: Escenario, rng: Rng): Mundo;
  paso(mundo: Mundo, dt: number): void;
  aplicarOrden(mundo: Mundo, orden: Orden): void;
  instantanea(mundo: Mundo): Instantanea;
  evaluar(mundo: Mundo): Evaluacion;
  /** Devuelve y vacía la cola de respuestas del reglamento (opcional). */
  eventos?(mundo: Mundo): EventoPrograma[];
  respuestas?(mundo: Mundo): Respuesta[];
}
export interface FuenteIntento {
  fuente: string;
  codigo: string;
  lenguaje: 'js' | 'python';
  diagnostico?: { mensaje: string; linea: number | null };
}
export type EntradaIntento =
  | { tipo: 'orden'; unidad: string; verbo: string; args: Orden['args'] }
  | ({ tipo: 'programa'; unidad: string } & FuenteIntento);
export interface GrabacionIntento {
  semillaIntento: number;
  programas: Record<string, FuenteIntento>;
  entradas: (EntradaIntento & { paso: number })[];
}
export interface DatosPartida<Escenario = DatoPlano> {
  reglas: string;
  version: string | number;
  escenario: Escenario;
  semilla: number;
  paso: number;
  ordenes: Orden[];
  intento?: GrabacionIntento;
}
export interface Partida<Mundo, Escenario, Evaluacion = DatoPlano> {
  mundo: Mundo & { sucesos: RegistroSucesos };
  iniciarGrabacion(semillaIntento: number, programas: GrabacionIntento['programas']): void;
  registrarEntrada(entrada: EntradaIntento): void;
  ordenar(orden: Orden): void;
  aplicarOrdenes(): void;
  paso(): void;
  instantanea(): Instantanea;
  sucesos(desdePaso?: number): Suceso[];
  evaluar(): Evaluacion;
  serializar(): DatosPartida<Escenario>;
  readonly pasoActual: number;
}

export const DT: 0.05;
export function avanzar(acum: number, mundo: RelojMundo, control: ControlAvance): number;
export function mulberry32(a: number): Rng;
export function crearRng(semilla: number): Rng;
export function pasoDe(t: number): number;
export function crearColaOrdenes(): ColaOrdenes;
export function crearRegistroSucesos(opciones?: { limite?: number }): RegistroSucesos;
export function adjuntarSucesos(mundo: object & { sucesos?: RegistroSucesos }, registro?: RegistroSucesos): RegistroSucesos;
export function anotarSuceso(mundo: MundoConSucesos, tipo: string, unidad?: string | null, datos?: Suceso['datos'] | null): void;
export function crearPartida<Mundo extends object, Escenario extends DatoPlano, Evaluacion>(opciones: {
  reglas: Reglamento<Mundo, Escenario, Evaluacion>;
  escenario: Escenario;
  semilla: number;
}): Partida<Mundo, Escenario, Evaluacion>;
export function restaurar<Mundo extends object, Escenario extends DatoPlano, Evaluacion>(datos: DatosPartida<Escenario>, reglas: Reglamento<Mundo, Escenario, Evaluacion>): Partida<Mundo, Escenario, Evaluacion>;
export function copiaPlana<T>(valor: T): T;
