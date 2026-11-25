import type { Reglamento, RegistroSucesos } from '../nucleo/index.js';
import type { DatoPlano } from '../protocolo/index.js';

export type Modo = 'campaign' | 'ensayo' | 'paridad';
export type Nivel = { clave: string; revision: number; hitos: string[];
  marco: { origen: number[]; tam?: number[]; puertas: number[]; bastiones: number[][] }; fabrica?: { origen: number[] } };
export type Batalla = { clave: string; war: number } | ({ clave: string } & Record<string, DatoPlano>);
export type HitoFabrica = {
  clave: string; fabrica: true; pistas: number;
  alEmpezar?: { entregas?: { lugar: string; pieza: string; n: number }[] };
  metas: { k: string; tipo: 'en' | 'lotes' | 'hechos' | 'tarima'; lugar?: string; pieza?: string; n: number }[];
};
export type PlantaNivel = typeof import('./niveles/nivel-1/fabrica.js').default;
export type Contenido = { default: Nivel; fabrica: PlantaNivel } & Record<string, Nivel | HitoFabrica | Batalla | PlantaNivel>;
export const niveles: Record<string, Contenido>;
export function esFabrica(clave: unknown): boolean;
export function hitosFabrica(nivel: Nivel): string[];
export function nivelFabrica(contenido: Contenido): Record<string, any>;
export function moduloFabrica(contenido: Contenido): Record<string, any>;
export const motorFabrica: ReturnType<typeof import('../fabrica/index.js').crearMotor>;
export function validarNivel(carpeta: string, contenido: Contenido, tipos: object,
  catalogo?: Record<string, Record<string, string>>): string[];
type Programas = { programas: Record<string, DatoPlano>; fuentes: Record<string, DatoPlano>; vinculos: Record<string, DatoPlano> };
type Posiciones = Record<string, { x: number; y: number }>;
export type Checkpoint<G> = Programas & {
  clave: string; revision: number; hito: string; fabrica: G; bodega: number; semillaFabrica: number; torretas: Posiciones;
};
export type Mundo<B, P> = {
  hito: string; modo: Modo; batalla: B | null; fabrica: P | null; bodega: { misiles: number } | null;
  semillaIntento?: number; semillaFabrica?: number; aviso?: string; sucesos?: RegistroSucesos;
} & Partial<Programas>;
export type Escenario<R, G> = Partial<Programas> & {
  hito: string; modo: Modo; reto: R | null; checkpoint?: Checkpoint<G>; fabrica?: G;
  semillaIntento?: number; semillaFabrica?: number; torretas?: Posiciones; bodega?: number;
};
type ConEscena<M, R, F, S, A> = Reglamento<M, R, F> & { escena(mundo: M): S; api: A };
type Planta = ReturnType<typeof import('./fabrica/index.js').motor.crear>;
type Guardado = ReturnType<typeof import('./fabrica/index.js').motor.serializar>;
export function crearReglamento<B, R, F, S, A>(
  war: ConEscena<B, { reto: R }, F, S, A> & { fijarSuministro(lanzador: object, ritmo: number): void; pasoConIntentoPuntual: Function; leerEnemigos: Function; danoEnArea: Function; velMisil: number },
  contenido: Contenido, retos: Record<string, R>
): ConEscena<Mundo<B, Planta>, Escenario<R, Guardado>, F, S | Record<string, DatoPlano>, A> & {
  id: 'campaign-v2'; serializar(m: Mundo<B, Planta>): Checkpoint<Guardado>;
  restaurar(cp: Checkpoint<Guardado>, semillaIntento: number, actuales?: Partial<Programas>): Mundo<B, Planta>;
  /** Cierra el hito de fábrica en curso con la planta jugada en su sesión y pasa al hito siguiente. */
  cerrarFabrica(m: Mundo<B, Planta>, plantaJugada?: Planta | null): boolean;
  /** La escena en metros del mapa papercraft, con `marco` y, fuera de paridad, los bastiones. */
  escenaMetros(m: Mundo<B, Planta>): Record<string, DatoPlano> & { marco: Marco; bastiones?: Bastion[] };
};
export type Marco = { origen: number[]; tam?: number[] };
export type Bastion = { indice: number; cx: number; cy: number; ocupado: string | null };
type Punto = { x: number; y: number };
export function escenaEnMetros<E extends object>(escena: E, origen: number[], tam?: number[] | null): E & { marco: Marco };
export function puntoEnMarco<T extends Punto>(punto: T, origen: number[]): T;
export function puntoEnMetros<T extends Punto>(punto: T, origen: number[]): T;

export { fichaClic } from './mecanicas/clic/ficha.js';
export { lugarDeObjetivo, repartirClic } from './mecanicas/clic/reglas.js';
type Verbo = { nombre: string; nombres: { python: string }; clase: string; firma: string[]; nota: string;
  paleta: string; await?: boolean; seudo?: { rotulo: string; lugar: string | null } };
export type FichaMecanica = { id: string; rol?: string; modelo?: string; capacidades?: string[];
  nombre?: string; primitiva?: string; experimental?: { vida: number; [clave: string]: unknown }; verbos: Verbo[]; lecturas: string[];
  eventos?: { nombre: string; objeto?: string; nombres: { python: string }; firma: string[]; parametro: string;
    campos: string[]; nota: string; seudo: string }[] };
export { fichas, piezasMoviles } from './paso.js';
export { default as salida } from './ensayos/salida.js';
export function mundoPantalla<B, P>(m: Mundo<B, P>): B | P;
