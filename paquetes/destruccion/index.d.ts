export type Vec = [number, number, number];
export type Rot = [number, number, number, number];
export type Caja = { tipo: 'caja'; medidas: Vec; hueco?: number };
export type Esfera = { tipo: 'esfera'; radio: number };
export type Forma = Caja | Esfera | { tipo: 'cilindro'; radio: number; alto: number; eje: 'x' | 'y' | 'z'; hueco?: number };
export type Zona = (Omit<Caja, 'hueco'> | Esfera) & { pos: Vec };
export type Material = { material: string; cantidad: number };
export type EstadoPieza = 'intacta' | 'dañada' | 'partida' | 'fundida' | null;
export type Arma = 'cinetico' | 'explosivo' | 'laser' | 'acido' | 'granada' | 'chorro';
export type Modo = 'hundiendose' | 'desvaneciendose';
export interface Pieza {
  id: string; forma: Forma; pos: Vec; rot: Rot; padre: string | null; union: { resistencia: number };
  materiales: Material[]; funcion: string | null; zonaFuncion?: Zona | null; aguante: number; color: string;
}
export interface Robot { id: string; piezas: Pieza[] }
export type Congelado<T> = T extends object ? { readonly [K in keyof T]: Congelado<T[K]> } : T;
export function definirRobot(def: Robot | Congelado<Robot>): Congelado<Robot>;
export type Orden = { arma: Arma; origen: Vec; direccion: Vec; potencia?: number; duracionAcido?: number; velocidad?: number; modo?: ModoChorro; duracion?: number; viento?: Vec };
export type ModoChorro = 'directo' | 'caotico';
export interface Proyectil { tipo: 'granada' | 'gota'; origen: Vec; modo?: ModoChorro; pos: Vec; velocidad: Vec; paso: number; disparo: number; indice?: number; presion?: number }
export interface Emisor { origen: Vec; direccion: Vec; modo: ModoChorro; viento: Vec; presion: number; pasos: number; indice: number; disparo: number }
export interface Charco { id: number; centro: Vec; final: number; radio: number; edad: number; activo: boolean; altura: number; inactivoDesde?: number }
export interface Impacto { uid: number; robot: string; pieza: string; fragmento: number; distancia: number; indice: number; pos: Vec }
export type TipoSuceso = 'granada-estalla' | 'salpicadura' | 'charco' | 'gota' | 'chorro-fin' | 'puente-cede' | 'puente-roto' | 'impacto' | 'union-rota' | 'pieza-suelta' | 'funcion-perdida' | 'fragmento' | 'reposo' | 'robot-caido' | 'resto-oculto';
export interface Suceso {
  paso: number; tipo: TipoSuceso; unidad: string | null; datos: {
    pieza?: string; fragmento?: number; disparo?: number; indice?: number; presion?: number; id?: number; normal?: Vec; impactos?: { fin: Vec; uid: number | null }[];
    seccion?: number; razon?: number; motivo?: string; padre?: number; funcion?: string; origen?: Vec | number; pos?: Vec; rot?: Rot; arma?: Arma
  }
}
export interface Informe {
  proyectil?: Proyectil; emisor?: Emisor; impacto: Impacto | null; afectadas: number[]; quitadas: (Material & { celdas: number })[];
  unionesRotas: Suceso[]; funcionesPerdidas: Suceso[]; sucesos: Suceso[];
}
export interface Volumen { fuente?: 'acido' | 'granada' | 'chorro' | 'charco'; tipo: Arma; a: Vec; b: Vec; radio: number; paso: number; hash: number; duracion?: number }
export interface Etiquetable { materiales: readonly Material[]; estado: EstadoPieza; funcion: string | null }
export function etiqueta(p: Etiquetable): string;
export interface VistaPieza extends Etiquetable {
  uid: number; robot: string; id: string; fragmento: number; padre: number | null; forma: Congelado<Forma>;
  color: string; pos: Vec; rot: Rot; funcionOriginal: string | null; zonaFuncion: Congelado<Zona> | null;
  version: number; mascara: readonly number[]; dim: Vec; celda: number; celdas: number; celdasIniciales: number;
  fundidas: number; pelicula?: Record<number, [number, number]>; volumenes: Volumen[]; salida: 'en-pie' | 'vuelo' | 'reposo' | Modo | 'oculto' | 'expuesto';
  carasUnion: { centro: Vec; eje: number; signo: number }[];
  puente: { seccion: number; razon: number; angulo: number; pivote: Vec } | null; mascaraBase: readonly number[];
  opacidad: number; hundimiento: number;
}
export interface Instantanea {
  proyectiles: Proyectil[]; emisores: Emisor[]; charcos: Charco[];
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
  estado(): Instantanea; sucesos(desde?: number): Suceso[]; terminarBatalla(): void; botin(): Botin;
  serializar(): string; cargar(texto: string): void;
}
export function crearMundo(opciones: { semilla: number }): Mundo;
export function cargar(texto: string): Mundo;
export const ARMAS: Congelado<{
  granada: Record<'velocidad' | 'potenciaPrincipal' | 'satelites' | 'alcance' | 'inicial' | 'radio' | 'alturaRebote' | 'distanciaMin' | 'distanciaMax', number>;
  chorro: Record<'velocidad' | 'duracion' | 'fasePlena' | 'presionMin' | 'aperturaFinal' | 'concentracion' | 'escalaRuido' | 'fusion' | 'inicial' | 'radio' | 'radioMax' | 'gotasMax' | 'manchasPorPieza', number> &
    Record<ModoChorro, { cono: number; arrastre: number; turbulencia: number }>;
  cinetico: { impulso: number; propagacion: number; radio: number }; explosivo: { impulso: number; radio: number; crater: number };
  laser: { radio: number; alcance: number; anillo: number }; acido: { inicial: number; radio: number; duracion: number; irregularidad: number };
}>;
export const MATERIALES: readonly string[];
export const FISICA: Readonly<Record<'dt' | 'fraccionesPorPaso' | 'celda' | 'gravedad' | 'restitucion' | 'friccion' | 'amortiguacion' | 'umbral' | 'pasosReposo' | 'escoria' | 'perdidaFuncion' | 'fraccionFundida' | 'radioUnion' | 'contactoReposo', number>>;
export const RESTOS: Readonly<{ visible: number; salida: number }>;
export const RENDIMIENTO: Readonly<Record<Exclude<EstadoPieza, null> | 'bordeFundido', number>>;
export const PUENTE: Readonly<Record<'capas' | 'flexion' | 'traccion' | 'ceder' | 'caidaMax' | 'giroPorPaso' | 'impulsoPorCelda', number>>;
export const CHARCO: Readonly<Record<'radio' | 'gota' | 'radioMax' | 'crecimiento' | 'duracion' | 'altura' | 'ascenso' | 'mancha' | 'irregularidad' | 'escalaRuido', number>>;
export const PROYECTIL: Readonly<{ alcance: number; tiempo: number }>;
export function radioDelCharco(c: Pick<Charco, 'id' | 'radio'>, x: number, y: number): number;
