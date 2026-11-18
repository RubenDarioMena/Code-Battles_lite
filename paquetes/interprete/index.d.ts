export interface Analizador { parse(fuente: string, opciones?: object): any }
export interface OpcionesInterprete {
  acorn: Analizador;
  presupuesto?: number;
  /** Capacidades de confianza: no inyectar accesos al sistema ni compiladores nativos. */
  globales?: Record<string, any>;
  depurar?: boolean | { parametro: string };
}
export interface Pausa { linea: number; nodo: string }
export interface Medida {
  nodos: number; linea: number | null; trabajos: number; pausas: number;
  cache: { arboles: number; caracteres: number }; liberado: boolean;
}
export interface Motor {
  global: Record<string, any>;
  /** Intrínsecos compartidos. Sin depuración, activar con la cola drenada; con depuración conserva presupuesto, pausas y trabajos por ámbito. */
  crearAmbito(globales?: Record<string, any>): { global: Record<string, any>; activar(): void; liberar(): void };
  ejecutar(fuente: string, opciones?: { usuario?: boolean }): any;
  vaciarTrabajos(): void;
  reiniciarPresupuesto(): void;
  medir(): Medida;
  /** Pausas del ámbito activo (o del global si no hay ámbito). */
  pausasPendientes(): Pausa[];
  /** Reanuda una sentencia; el consumidor decide cuándo drenar trabajos. */
  reanudar(): Pausa | null;
  liberar(): void;
}
export function crearInterprete(opciones: OpcionesInterprete): Motor;
export class PresupuestoAgotado extends Error {
  readonly code: 'CBL_PRESUPUESTO'; cuenta: number; linea: number | null; __linea: number | null;
  constructor(cuenta: number, linea: number | null);
}
