// En suelo plano, la esfera de niebla opaca (radio 1,75d) corta el suelo
// en un disco de radio d·√(1,75² − sen²(pitch)). Su centro dista d·cos(pitch)
// del objetivo. A d=60, los discos iniciales alcanzan ambas columnas centrales
// en las cuatro filas. Con d≤36, incluso al girar en cualquier azimut, el
// alcance desde el objetivo es ≤68,5 m en batalla y ≤74,8 m en fábrica.
// Los discos caben en [100,300] × [0,156] para los dos centros de encuadre.
// Un desplazamiento libre del objetivo cambia esa cobertura.
export const terrenosBatalla = [
  'terreno-0-1', 'terreno-0-2',
  'terreno-1-1', 'terreno-1-2',
  'terreno-2-1', 'terreno-2-2',
];
// Hasta zoomNitido la niebla cubre cualquier giro solo con estas seis teselas. Más lejos (zoomMax, y el
// encuadre de las pantallas estrechas) se ve el resto del mapa: terrenosLejanos se cargan cuando ya están
// las del campo, así la Batalla se puede jugar mientras llegan.
export const terrenosLejanos = [0, 1, 2, 3].flatMap(fila => [0, 1, 2, 3].map(col => `terreno-${fila}-${col}`))
  .filter(id => !terrenosBatalla.includes(id));
export const zoomNitido = 36;
export const zoomMax = 60;

// Interpreto los bosques como rectángulos centrados en (x,z), igual que la
// losa. Agrupo árboles en los claros de sus bordes y aclaro el frente este.
/** @type {Array<{ id: string, x: number, z: number, giro: number, escala: number }>} giro en radianes alrededor de Y. */
export const kit = [
  { id: 'pino-alto', x: 135, z: 12, giro: 0.6, escala: 1.12 },
  { id: 'pino-joven', x: 143, z: 17, giro: 2.3, escala: 0.94 },
  { id: 'pino-alto', x: 150, z: 11, giro: 1.2, escala: 1.18 },
  { id: 'matorral', x: 157, z: 16, giro: 3.4, escala: 0.9 },
  { id: 'pino-joven', x: 166, z: 29, giro: 4.1, escala: 1.03 },
  { id: 'pino-alto', x: 174, z: 34, giro: 2.7, escala: 1.14 },
  { id: 'pino-joven', x: 181, z: 30, giro: 5.2, escala: 0.88 },
  { id: 'matorral', x: 168, z: 38, giro: 1.5, escala: 1.08 },
  { id: 'roca', x: 197, z: 29, giro: 2.2, escala: 1.2 },
  { id: 'pino-joven', x: 202, z: 35, giro: 0.4, escala: 0.92 },
  { id: 'laja', x: 218, z: 39, giro: 4.3, escala: 1.22 },
  { id: 'pino-alto', x: 190, z: 51, giro: 1.1, escala: 1.06 },
  { id: 'matorral', x: 187, z: 57, giro: 4.8, escala: 0.86 },
  { id: 'pino-joven', x: 197, z: 56, giro: 3.5, escala: 0.93 },
  { id: 'alcornoque', x: 162, z: 61, giro: 0.8, escala: 1.08 },
  { id: 'espigas', x: 166, z: 67, giro: 1.9, escala: 1.1 },
  { id: 'esparto', x: 161, z: 69, giro: 5.6, escala: 0.9 },
  { id: 'pino-alto', x: 131, z: 92, giro: 0.1, escala: 1.04 },
  { id: 'pino-joven', x: 138, z: 96, giro: 2.8, escala: 0.88 },
  { id: 'alcornoque', x: 144, z: 90, giro: 3.2, escala: 0.99 },
  { id: 'matorral', x: 145, z: 98, giro: 1.4, escala: 1.04 },
  { id: 'pino-joven', x: 158, z: 86, giro: 2.1, escala: 1.09 },
  { id: 'matorral', x: 163, z: 91, giro: 4.6, escala: 0.95 },
  { id: 'pino-alto', x: 174, z: 99, giro: 5.1, escala: 1.15 },
  { id: 'alcornoque', x: 184, z: 96, giro: 2.5, escala: 0.97 },
  { id: 'esparto', x: 191, z: 96, giro: 1.7, escala: 1.1 },
  { id: 'pino-joven', x: 221, z: 56, giro: 4.2, escala: 1.05 },
  { id: 'matorral', x: 224, z: 62, giro: 2.6, escala: 0.91 },
  { id: 'laja', x: 232, z: 65, giro: 0.7, escala: 1.12 },
  { id: 'esparto', x: 239, z: 63, giro: 3.7, escala: 0.85 },
  { id: 'alcornoque', x: 249, z: 67, giro: 1.6, escala: 1.03 },
  { id: 'matorral', x: 255, z: 71, giro: 5.4, escala: 0.93 },
  { id: 'roca', x: 263, z: 50, giro: 2.9, escala: 1.21 },
  { id: 'esparto', x: 269, z: 53, giro: 0.5, escala: 1.13 },
  { id: 'pino-joven', x: 247, z: 98, giro: 1.3, escala: 1.08 },
  { id: 'espigas', x: 241, z: 97, giro: 4.4, escala: 1.02 },
  { id: 'matorral', x: 254, z: 101, giro: 2.4, escala: 1.07 },
  { id: 'pino-alto', x: 230, z: 107, giro: 3.6, escala: 1.16 },
  { id: 'matorral', x: 224, z: 104, giro: 0.9, escala: 0.96 },
  { id: 'pino-joven', x: 215, z: 112, giro: 5.8, escala: 0.89 },
  { id: 'roca', x: 207, z: 120, giro: 2.0, escala: 1.17 },
  { id: 'esparto', x: 212, z: 124, giro: 4.7, escala: 1.02 },
  { id: 'pino-alto', x: 187, z: 130, giro: 1.8, escala: 1.11 },
  { id: 'matorral', x: 181, z: 126, giro: 3.1, escala: 0.98 },
  { id: 'pino-joven', x: 145, z: 131, giro: 5.5, escala: 1.04 },
  { id: 'laja', x: 111, z: 128, giro: 2.3, escala: 1.23 },
  { id: 'matorral', x: 117, z: 133, giro: 0.3, escala: 0.87 },
];

// Rectángulos [xMin,zMin,xMax,zMax], antes de aplicar margen. En el río
// cada ancho es el diámetro local en el vértice correspondiente.
export const zonasProhibidas = {
  campo: { caja: [204, 72, 236, 90], margen: 3 },
  fabrica: { caja: [170, 60, 207, 90], margen: 0 },
  losa: { centro: [93, 72], metros: [41, 27], margen: 2 },
  muralla: {
    puntos: [[207, 44], [207, 60], [207, 78], [207, 90], [204, 99], [198, 106], [188, 111], [173, 114], [151, 115], [133, 116], [113, 117]],
    margen: 6,
  },
  carriles: [
    { nombre: 'Paso del este', puntos: [[400, 53], [371, 59], [340, 64], [308, 76], [276, 82], [247, 82], [208, 81]], ancho: 6.3, margen: 2 },
    { nombre: 'Bifurcación', puntos: [[400, 129], [371, 117], [343, 108], [316, 95], [286, 85], [278, 82]], ancho: 5, margen: 2 },
    { nombre: 'Flanco sur', puntos: [[243, 208], [235, 192], [220, 177], [199, 169], [178, 159], [166, 145], [156, 115]], ancho: 5.8, margen: 2 },
    { nombre: 'Cañada', puntos: [[400, 187], [378, 174], [355, 160], [329, 150], [304, 141], [278, 140], [249, 147], [220, 159], [199, 169]], ancho: 4.3, margen: 2 },
  ],
  carretera: { nombre: 'Proveedores', puntos: [[0, 81], [19, 83], [36, 83], [58, 77], [77, 73], [93, 73]], ancho: 5.6, margen: 2 },
  rio: {
    nombre: 'Arroyo del aliso',
    puntos: [[55, 0], [61, 8], [74, 13], [90, 15], [106, 14], [117, 18], [124, 24], [132, 29], [140, 30]],
    ancho: [8, 9, 8, 7, 6, 5, 4, 3, 1], margen: 0,
  },
};
