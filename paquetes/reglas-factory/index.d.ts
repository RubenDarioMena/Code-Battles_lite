import type { DatoPlano } from '../protocolo/index.js';
import type { Reglamento, RegistroSucesos } from '../nucleo/index.js';

export type Punto = { x: number; y: number };
export type Meta = { tipo?: 'vaciar'; id: string; mat: string; n?: number };
export type Edificio = Punto & {
  id: string; tipo: 'bodega' | 'maquina'; nombre: string; puerta: Punto;
  stock?: Record<string, number>; oculto?: boolean; acepta?: string; cap?: number; tProceso?: number;
};
export type Bloque = {
  t: string; id?: string; origen?: string; mat?: string; destino?: string; n?: number; s?: number;
  cuerpo?: Bloque[]; sino?: Bloque[]; cond?: { lugar: string; mat: string; op: string; n: number };
};
export type RetoBloques = {
  titulo: string; objetivo: string; leccion: string; pista: string; nuevo?: boolean;
  ladrillos: string[]; robot: Punto; entidades: Edificio[]; metas: Meta[];
  maxRechazos?: number | null; maxVacios?: number | null; tiempoMax?: number | null;
  stockPorIntento?: number[]; inicial: Bloque[];
};
export type Reto = Omit<RetoBloques, 'inicial'> & {
  serie: 'factory'; mapa: { cols: number; rows: number }; fin: string; limite: number; mejora: string;
  robots: (Punto & { id: string })[]; lanzadores: DatoPlano[]; sensores: DatoPlano[];
  reparadores: number; oleadas: DatoPlano[]; inicial: Record<string, string[]>;
  herramientas: { programa: string[]; mapa: string[] };
};
export type Escenario = { reto: Reto; intento?: number };
export interface Final { fin: string; motivo: string | null; mensaje: string | null }
export interface FichaEnCola {
  tRecogida: number; tEntrega: number; tInicio?: number; origen: string;
}
export interface Entidad extends Edificio {
  clase: string; cx: number; cy: number; entrada?: number; procesando?: boolean;
  progreso?: number; recibido: Record<string, number>; entregado?: Record<string, number>;
  producido?: number; ciclos?: number; rechazos?: number; derrames?: number; suelo?: DatoPlano[];
  produce?: string; ratio?: number; cola?: FichaEnCola[]; actual?: FichaEnCola | null;
  fichas?: { n: number; origen: string; viaje: number; espera: number; proceso: number; total: number }[];
  tOcupada?: number;
}
export interface Robot extends Punto {
  id: string; clase: string; readonly cx: number; readonly cy: number;
  carga: string | null; cargaDesde: number | null; cargaOrigen: string | null;
  tCaminando: number; viajes: number;
  tarea: { wps: Punto[]; op: number; fin(): string; op0?: number; verbo?: string; lugar?: DatoPlano } | null;
}
export interface Mundo {
  def: Reto; t: number; activo: boolean; fin: string | null; final?: Final; sucesos?: RegistroSucesos;
  rechazos: number; ultimoRechazo: { id: string; mat: string; motivo: string } | null;
  derrames: number; vacios: number; ultimoVacio: { id: string; mat: string } | null;
  revelado: boolean; stockOculto: number | null; entidades: Entidad[]; robot: Robot;
  porId: Record<string, Partial<Entidad & Robot> & Pick<Robot, 'id' | 'clase' | 'cx' | 'cy'>>; maquinas: (Entidad | Robot)[]; programables: Robot[];
  lanzadores: DatoPlano[]; sensores: DatoPlano[]; reparadores: DatoPlano[]; enemigos: DatoPlano[];
  misiles: DatoPlano[]; pendientes: DatoPlano[]; colaReparar: DatoPlano[];
  uso: Record<string, Record<string, number>>; eventos: DatoPlano[];
  verbos: Record<string, number>; resultados: Record<string, number>;
  consolas: { log: number; info: number; warn: number; error: number };
}
export type LecturaFactory = {
  porId: Record<string, { id: string; tipo: string; stock?: Record<string, number>; acepta?: string; entrada?: number }>;
  entidades: { id: string }[];
};
export interface Ganchos {
  terminarOrden(resultado: string): void;
  terminar(fin: string, motivo: string | null, mensaje: string | null): void;
  programaAcabado(): boolean; llamadaPendiente(): boolean;
}
export interface Conexion {
  paso(dt: number): void; iniciarOrden(verbo: string, args: DatoPlano[]): void;
  sensor(lugar: string, mat: string): number | null; metaCumplida(meta: Meta): boolean;
  faltantes(): string[]; evaluar(): void;
}
export interface Retos {
  RETOS: Reto[]; propio: Reto; normalizar(datos: unknown): Reto;
  generar(programa: { cuerpo: Bloque[] }): { codigo: string; mapa: string[] };
}
export interface ReglamentoFactory extends Reglamento<Mundo, Escenario, Final | null> {
  id: 'factory'; version: 1;
  respuestas(mundo: Mundo): import('../nucleo/index.js').Respuesta[];
  /** Lo que dibujan las vistas: datos planos independientes del mundo (fase 2). */
  escena(mundo: Mundo): { t: number; porId: Record<string, any>; [clave: string]: any };
  api: { ordenes: string[]; lecturas: string[]; nombres: Record<string, string>; materiales: string[] };
}
export function crear(def: Reto, intento: number): Mundo;
export function validar(mundo: Pick<Mundo, 'entidades' | 'porId'> | LecturaFactory, verbo: string, args: DatoPlano[]): string | null;
export function instantaneaHistorica(mundo: Mundo): LecturaFactory;
export const MATERIALES: string[];
export const retos: Retos;
declare const reglamento: ReglamentoFactory;
export default reglamento;
