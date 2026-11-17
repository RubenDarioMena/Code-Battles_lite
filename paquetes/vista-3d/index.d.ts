export interface EstadoVista {
  readonly efectos?: { calidad: import('../vfx/index.js').Calidad; sinDestellos?: boolean };
  readonly medicionEfectos?: { ahora(): number; registrar(muestra: { vista: string; vivas: number; particulasMs: number; dibujarMs: number }): void };
  readonly escena: Readonly<Record<string, any>> | null;
  readonly seleccion: string | null;
  readonly seleccionadas: ReadonlySet<string>;
  readonly arrastreCampo: any;
  readonly cols: number;
  readonly rows: number;
  readonly col?: Record<string, string>;
}
export interface DependenciasComunes {
  /** Three r128 inyectado por la entrada; undefined permite la caída al plano. */
  THREE?: any;
  $(id: string): any;
  FUNCIONES: Record<string, any>;
  funcionDe(unidad: any): { principal: string; secundaria?: string };
  leerVar(clave: string): string;
  radioDe(unidad: any): number;
}
export interface TerrenoEditorAPI {
  crearGeometria(three: any, datos: any): any;
  crearGeometriaAgua(three: any, datos: any): any;
  BLOQUES: { geometria(three: any, bloque: any): any };
}
export interface DependenciasWar extends DependenciasComunes {
  montarEfectos?: (datos: any) => void;
  ES_FACTORY: boolean;
  ARCO: number[];
  FR: number;
  HALO: Record<string, number[][]>;
  INTENSIDAD: Record<string, number>;
  LINEA_BASE: number;
  LUCES: Record<string, number[][]>;
  MISIL: { radio: number; [clave: string]: any };
  TIPOS: Record<string, any>;
  alcance(tipo: string): number;
  direccionDe(unidad: any, ahora: number): number;
  visual: { halo: string; intensidad: string; brillo: string; [clave: string]: any };
  terreno?: TerrenoEditorAPI;
  /** Datos ya validados por la app; null conserva el paisaje predeterminado. */
  terrenoEditor?: any;
}
export interface DependenciasCampaign extends DependenciasComunes {
  mapa: any;
  crearTerreno?: (mapa: any) => any;
  reglas: {
    esRobot(unidad: any): boolean;
    esMaquina(unidad: any): boolean;
    estadoMaquina(unidad: any): string;
    TARIMA_CAP: number;
    RECETAS: Record<string, any>;
    BANDA: { vel: number };
  };
}
/** Último fotograma enviado al renderer (incluye paisaje, máquinas y VFX). */
export interface MedidaRender3D { calls: number; triangles: number }
export interface Vista3D {
  destruir(): void;
  construir(): void;
  actualizar(off: number, ahora: number): void;
  render(): void;
  tamano(w: number, h: number): void;
  proyectar(x: number, alto: number, y: number, w: number, h: number): { x: number; y: number; visible: boolean };
  elegir(px: number, py: number, w: number, h: number): string | null;
  suelo(px: number, py: number, w: number, h: number): { x: number; y: number; z: number } | null;
  centrar(x: number, y: number): void;
  recentrar(): void;
  anillosDe(id?: string | null): void;
  aplicarColores(): void;
  girar(da: number, px: number, py: number, w: number, h: number): void;
  retrato(tipo?: string, w?: number, h?: number): string | null;
  camara(): Record<string, any> & { dibujo?: MedidaRender3D };
}
export interface VistaCampaign3D extends Vista3D {
  batalla(valor: boolean): void;
  verCampo(): void;
  terreno: any;
}
export function crear3D(estado: EstadoVista, deps: DependenciasWar): Vista3D | null;
export function crearCampaign3D(estado: EstadoVista, deps: DependenciasCampaign): VistaCampaign3D | null;
export const factory3d: {
  construir(ctx: any): any;
  actualizar(contenido: any, ctx: any, dtReal: number): void;
  cargar(): Promise<any>;
  ik(h: number, v: number): { a1: number; a2: number; a3: number };
  ultimo: any | null;
};

export type { Vista } from '../protocolo/index.js';
import type { Vista } from '../protocolo/index.js';
export type OpcionesVista3D = (DependenciasWar | DependenciasCampaign) & {
  serie: 'war' | 'factory' | 'campaign';
  dt: number;
  estado?: EstadoVista;
  cols?: number;
  rows?: number;
  canvas?: HTMLCanvasElement;
  tema?: Record<string, string>;
  calidad?: import('../vfx/index.js').Calidad;
};
export interface VistaCreada3D extends Omit<Vista3D, 'elegir' | 'proyectar' | 'suelo'>, Vista {
  vaciar(): void;
  suelo(x: number, y: number): { x: number; y: number; z: number } | null;
  batalla?(valor: boolean): void;
  verCampo?(): void;
  terreno?: any;
}
export function crearVista(contenedor: HTMLElement, opciones: OpcionesVista3D): VistaCreada3D | null;

export { crearDibujanteEfectos } from './efectos.js';
