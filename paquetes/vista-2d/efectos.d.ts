import type { Particula } from '../vfx/index.js';
export interface OpcionesEfectos2D {
  T?: number; ox?: number; oy?: number;
  proyectar?: (x: number, y: number, z: number) => { x: number; y: number };
  crearLienzo?: (lado: number) => any;
  limiteCache?: number;
}
export function crearDibujanteEfectos(opciones?: OpcionesEfectos2D): {
  dibujar(ctx2: CanvasRenderingContext2D | any, particulas: Particula[]): void;
  vaciarCache(): void; destruir(): void;
};
