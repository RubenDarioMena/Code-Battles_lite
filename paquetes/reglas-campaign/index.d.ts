import type { DatoPlano, Instantanea } from '../protocolo/index.js';
import type { Reglamento, RegistroSucesos } from '../nucleo/index.js';

export type Punto = { x: number; y: number };
export type Meta = { k: string; tipo: string; lugar?: string; pieza?: string; n: number };
export type Hito = { clave: string; titulo: string; pistas: number; metas: Meta[];
  alEmpezar?: { entregas?: { lugar: string; pieza: string; n: number }[] } };
export type Nivel = {
  serie: string; clave: string; revision: number; titulo: string;
  mapa: { cols: number; rows: number; dianas: Punto[]; [clave: string]: DatoPlano };
  unidades: UnidadInicial[]; hitos: Hito[]; inicial: Record<string, string[]>; vivos: string[];
  presupuesto: number; premioHito: number; energia: number;
  robots: { id: string }[]; lanzadores: DatoPlano[]; sensores: DatoPlano[]; oleadas: DatoPlano[];
  metas: Record<string, DatoPlano>; pista: string; objetivo: string; leccion: string;
};
export type UnidadInicial = {
  id: string; clase: string; tipo?: string; cx?: number; cy?: number; ax?: number; ay?: number;
  desde?: number; pad?: string | null; tarimaInicial?: boolean; x0?: number; y0?: number; x1?: number; y1?: number;
};
export type CargaObjeto = { tipo: string; id: string };
export type Carga = (string & Partial<CargaObjeto>) | CargaObjeto;
export type Encargo = { id: string | number; verbo: string; args: DatoPlano[] };
export type Tarea = { id: string | number; verbo: string; lugar: string; pieza: string | null;
  x: number; y: number; x0: number; y0: number; fase: string; op: number; op0: number };
export type Pedido = { pieza: string; n: number; pide: number; llega: number; programada?: boolean };
export type Tarima = { id: string; piezas: string[]; en: string };
export type Unidad = UnidadInicial & {
  presente: boolean; encendida: boolean; carga?: Carga | null; tarea?: Tarea | null; rumbo?: number;
  st?: Record<string, number>; receta?: string; marcha?: boolean; entrada?: Record<string, number>;
  salida?: string[]; proceso?: { receta: string; prog: number } | null;
  cambio?: { a: string; falta: number; total: number } | null; enVilo?: boolean;
  luz?: string | null; hechos?: number; largo?: number; piezas?: { pieza: string; s: number }[];
  tarima?: string | null; pedidos?: Pedido[]; maquina?: string | null;
  misiles?: number; porBanda?: number; aMano?: number; yaw?: number; lanzados?: number;
};
// Exactamente los campos del checkpoint histórico; las tareas se guardan como null.
export type Guardado = {
  version: number; nivel: string; rev: number; t: number; hito: number; completado: boolean; hitosT: number[];
  presupuesto: number; gastado: number; ingresado: number; unidades: Unidad[]; tarimas: Tarima[];
  sigTarima: number; sigMisil: number; tSuministro: number; producidos: Record<string, number>; pedidos: number;
};
export type Misil = { id: number; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number;
  t0: number; dur: number; arco: number; hecho?: boolean };
export type Mundo = Guardado & {
  serie: string; def: Nivel; activo: boolean; fin: string | null; sucesos?: RegistroSucesos;
  energia: { max: number; uso: number; factor: number }; porId: Record<string, Unidad>;
  maquinas: Unidad[]; programables: Unidad[]; robots: Unidad[]; estaciones: Unidad[]; lotes: Unidad[];
  banda: Unidad; bahia: Unidad; arsenal: Unidad; torretas: Unidad[]; tarimaPorId: Record<string, Tarima>;
  salva: { sig: number; n: number; hecha: boolean } | null; misiles: Misil[];
  explosiones: { t0: number; x: number; y: number; z: number }[];
  lanzadores: DatoPlano[]; sensores: DatoPlano[]; reparadores: DatoPlano[]; enemigos: DatoPlano[];
  pendientes: DatoPlano[]; colaReparar: DatoPlano[]; derribados: DatoPlano[]; eventos: DatoPlano[];
  uso: Record<string, Record<string, number>>; consolas: { log: number; info: number; warn: number; error: number };
};
export type Escenario = { reto: Nivel; guardado?: Guardado | null };
export type Lectura = { k: string; on?: boolean; prog?: boolean; recetas?: string[]; running?: boolean;
  recipe?: string; state?: string; pending?: number; [clave: string]: DatoPlano };
export type LecturaCampaign = { t: number; u: Record<string, Lectura>; maestro: string | null;
  presupuesto: number; coste: Record<string, number>; piezas: string[]; luces: string[] };
export type EstadoMeta = Meta & { valor: number; cumplida: boolean };
export interface Ganchos {
  registrar?(id: string, linea: number | null, que: string, resultado: string, clase: string): void;
  terminarOrden?(unidad: string, encargo: string | number, resultado: string): void;
  hito?(info: { hecho: number; siguiente: number | null; completado: boolean }): void;
  entrega?(bahia: Unidad, pedido: Pedido): void;
  salva?(salva: Mundo['salva']): void;
}
export interface Conexion {
  paso(dt: number): void; iniciarOrden(unidad: string, encargo: Encargo): string | null;
  cancelarTareas(): void; aplicarModo(unidad: string, verbo: string, args: DatoPlano[]): string;
  soltarLuces(): void; evaluar(): void; salva(): boolean; quieto(): boolean;
  instantanea(): LecturaCampaign; metas(): EstadoMeta[]; cuantos(id: string, pieza: string): number | null;
}
export type Receta = { entra: Record<string, number>; sale: string; t: number };
export type CatalogoMaquina = { nombre: string; recetas: string[]; entrada?: number; salida: number;
  kw: number; peso: number; ranuras?: Record<string, number>; cambio?: number };
export type CatalogoRobot = { vel: number; op: number; cargaMax?: number };
export const VERSION: number;
export function crear(def: Nivel, guardado?: Guardado | null): Mundo;
export function serializar(mundo: Mundo | Guardado): Guardado;
export function indexar(mundo: Mundo): void;
export function instantaneaHistorica(mundo: Mundo): LecturaCampaign;
export function validar(snap: LecturaCampaign, propia: string, unidad: string, verbo: string, args: DatoPlano[]): string | null;
export function modoEnSnap(snap: LecturaCampaign, unidad: string, verbo: string, args: DatoPlano[]): string;
export function metas(mundo: Mundo): EstadoMeta[];
export function cuantos(mundo: Mundo, id: string, pieza: string): number | null;
export function enLotes(mundo: Mundo, pieza: string): number;
export function estadoMaquina(unidad: Unidad): string;
export function totalEntrada(unidad: Unidad): number;
export function esMaquina(unidad: UnidadInicial): boolean;
export function esRobot(unidad: UnidadInicial): boolean;
export const PIEZAS: Record<string, { nombre: string; clase: string; crudo?: boolean }>;
export const RECETAS: Record<string, Receta>;
export const MAQUINAS: Record<string, CatalogoMaquina>;
export const ROBOT: Record<string, CatalogoRobot>;
export const BANDA: { vel: number; paso: number; kw: number };
export const COSTE: Record<string, number>;
export const PEDIDO: { n: number; espera: number; programada: number; cola: number };
export const ARSENAL: { cap: number; pago: number; suministro: number };
export const TORRETA: { cap: number; cadencia: number; vel: number; alto: number };
export const LUCES: string[];
export const TARIMA_CAP: number;
export const HITO_MAESTRO: number;
export const nivel: { RETOS: Nivel[]; NIVEL: Nivel; MAPA: Nivel['mapa'] };
export function restaurar(guardado: Guardado, reto?: Nivel): Mundo;
export function quieto(mundo: Mundo): boolean;
export type Final = { fin: 'victoria'; hito: number; completado: true };
export interface ReglamentoCampaign extends Reglamento<Mundo, Escenario, Final | null> {
  id: 'campaign'; version: number; instantanea(mundo: Mundo): Instantanea;
  respuestas(mundo: Mundo): import('../nucleo/index.js').Respuesta[];
  /** Lo que dibujan las vistas: datos planos independientes del mundo (fase 2). */
  escena(mundo: Mundo): { t: number; porId: Record<string, any>; [clave: string]: any };
  api: { encargos: string[]; modos: string[]; lecturas: string[]; espera: string;
    piezas: typeof PIEZAS; recetas: typeof RECETAS;
    maquinas: typeof MAQUINAS; robots: typeof ROBOT; luces: string[] };
}
declare const reglamento: ReglamentoCampaign;
export default reglamento;
