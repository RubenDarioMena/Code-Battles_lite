export type Vec = [number, number, number];
export type Rot = [number, number, number, number];
export type Caja = { tipo: 'caja'; medidas: Vec };
export type Esfera = { tipo: 'esfera'; radio: number };
export type Forma = Caja | Esfera | { tipo: 'cilindro'; radio: number; alto: number; eje: 'x' | 'y' | 'z' };
export type Zona = (Caja | Esfera) & { pos: Vec };
export type Material = { material: string; cantidad: number };
export type EstadoPieza = 'intacta' | 'dañada' | 'partida' | 'fundida' | null;
export type Arma = 'cinetico' | 'explosivo' | 'laser' | 'acido';
export type Modo = 'hundiendose' | 'desvaneciendose';
export interface Pieza {
  id: string; forma: Forma; pos: Vec; rot: Rot; padre: string | null; union: { resistencia: number };
  materiales: Material[]; funcion: string | null; zonaFuncion?: Zona | null; aguante: number; color: string;
}
export interface Robot { id: string; piezas: Pieza[] }
export type Congelado<T> = T extends object ? { readonly [K in keyof T]: Congelado<T[K]> } : T;
export function definirRobot(def: Robot | Congelado<Robot>): Congelado<Robot>;
export type Orden = { arma: Arma; origen: Vec; direccion: Vec; potencia?: number };
export interface Impacto { uid: number; robot: string; pieza: string; fragmento: number; distancia: number; indice: number; pos: Vec }
export type TipoSuceso = 'impacto' | 'union-rota' | 'pieza-suelta' | 'funcion-perdida' | 'fragmento' | 'reposo' | 'robot-caido' | 'resto-oculto';
export interface Suceso {
  paso: number; tipo: TipoSuceso; unidad: string; datos: {
    pieza: string; fragmento: number;
    motivo?: string; padre?: number; funcion?: string; origen?: Vec | number; pos?: Vec; rot?: Rot; arma?: Arma
  }
}
export interface Informe {
  impacto: Impacto | null; afectadas: number[]; quitadas: (Material & { celdas: number })[];
  unionesRotas: Suceso[]; funcionesPerdidas: Suceso[]; sucesos: Suceso[];
}
export interface Volumen { tipo: Arma; a: Vec; b: Vec; radio: number; paso: number; hash: number }
export interface Etiquetable { materiales: readonly Material[]; estado: EstadoPieza; funcion: string | null }
export function etiqueta(p: Etiquetable): string;
export interface VistaPieza extends Etiquetable {
  uid: number; robot: string; id: string; fragmento: number; padre: number | null; forma: Congelado<Forma>;
  color: string; pos: Vec; rot: Rot; funcionOriginal: string | null; zonaFuncion: Congelado<Zona> | null;
  version: number; mascara: readonly number[]; dim: Vec; celda: number; celdas: number; celdasIniciales: number;
  fundidas: number; volumenes: Volumen[]; salida: 'en-pie' | 'vuelo' | 'reposo' | Modo | 'oculto' | 'expuesto';
  opacidad: number; hundimiento: number;
}
export interface Instantanea {
  paso: number; tiempo: number; terminada: boolean; restos: Resto[];
  robots: { id: string; caido: boolean; piezas: (number | null)[] }[]; piezas: VistaPieza[];
}
export interface Resto extends Etiquetable {
  robot: string; pieza: string; fragmento: number; etiqueta: string; funcionOriginal: string | null;
  pos: Vec; rot: Rot; mascara: readonly number[]; instante: number;
}
export interface Botin { restos: Resto[]; total: { materiales: Record<string, number>; funciones: Record<string, number> } }
export interface Mundo {
  agregarRobot(def: Robot | Congelado<Robot>, pose?: { pos?: Vec; rumbo?: number }): string;
  raycast(rayo: Pick<Orden, 'origen' | 'direccion'>): Impacto | null;
  disparar(orden: Orden): Informe; avanzar(segundos: number): void; desaparicion(modo: Modo): void;
  estado(): Instantanea; sucesos(): Suceso[]; terminarBatalla(): void; botin(): Botin;
  serializar(): string; cargar(texto: string): void;
}
export function crearMundo(opciones: { semilla: number }): Mundo;
export function cargar(texto: string): Mundo;
export const ARMAS: Congelado<{
  cinetico: { impulso: number; propagacion: number; radio: number }; explosivo: { impulso: number; radio: number; crater: number };
  laser: { radio: number; alcance: number; anillo: number }; acido: { inicial: number; radio: number; duracion: number; irregularidad: number };
}>;
export const MATERIALES: readonly string[];
export const FISICA: Readonly<Record<'dt' | 'fraccionesPorPaso' | 'celda' | 'gravedad' | 'restitucion' | 'friccion' | 'amortiguacion' | 'umbral' | 'pasosReposo' | 'escoria' | 'perdidaFuncion' | 'fraccionFundida' | 'radioUnion', number>>;
export const RESTOS: Readonly<{ visible: number; salida: number }>;
export const RENDIMIENTO: Readonly<Record<Exclude<EstadoPieza, null> | 'bordeFundido', number>>;
