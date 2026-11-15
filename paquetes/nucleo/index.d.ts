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
export interface Reglamento<Mundo, Escenario, Evaluacion = DatoPlano> {
  id: string;
  version: string | number;
  crearMundo(escenario: Escenario, rng: Rng): Mundo;
  paso(mundo: Mundo, dt: number): void;
  aplicarOrden(mundo: Mundo, orden: Orden): void;
  instantanea(mundo: Mundo): Instantanea;
  evaluar(mundo: Mundo): Evaluacion;
}
export interface DatosPartida<Escenario = DatoPlano> {
  reglas: string;
  version: string | number;
  escenario: Escenario;
  semilla: number;
  paso: number;
  ordenes: Orden[];
}
export interface Partida<Mundo, Escenario, Evaluacion = DatoPlano> {
  mundo: Mundo & { sucesos: RegistroSucesos };
  ordenar(orden: Orden): void;
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
