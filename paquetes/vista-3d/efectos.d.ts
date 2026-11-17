import type { Particula } from '../vfx/index.js';
export interface OpcionesEfectos3D {
  pixelRatio?: number; alturaBufer: number; fov: number;
  capacidad?: number;
  /** Máximo físico: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]; respaldo conservador 64. */
  maxPunto?: number;
}
export function crearDibujanteEfectos(THREE: any, grupo: any, opciones: OpcionesEfectos3D): {
  dibujar(particulas: Particula[]): void;
  redimensionar(opciones: { alturaCss: number; fov?: number; pixelRatio?: number }): void;
  destruir(): void;
};
