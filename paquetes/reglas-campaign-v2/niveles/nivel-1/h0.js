// Una prensa instalada junto a la bodega. La tolva recibe acero y la salida cae en el depósito.
export default {
  clave: 'h0', titulo: 'cv2.h0.titulo',
  mapa: {
    cols: 200, rows: 104,
    // Muralla: baja recta desde el monte del norte y gira al suroeste hasta el monte del sur.
    muralla: [[104.5, 26.5], [104.5, 62], [104, 68], [102.5, 74], [99.5, 80], [94.5, 85], [87, 88.6], [78, 90.6], [66, 91.8], [51, 92.8]],
    // Losa de la fábrica inicial, pegada a la muralla.
    losa: { x0: 70, y0: 42, x1: 103, y1: 62 },
    // Los robots se mueven por este pasillo: todos los puntos de trabajo quedan dentro (sin esquivar).
    pasillo: { x0: 72.5, y0: 49, x1: 102.6, y1: 54 },
    // Carretera de los proveedores: entra por el oeste y termina en la bahía.
    camino: [[0, 50], [18, 52.5], [36, 53.5], [54, 51.5], [70, 51.5]],
    // Montes del boceto: centro, radios, altura y semilla de sus crestas.
    montes: [
      { x: 116, y: 11, rx: 34, ry: 16, alto: 34, semilla: 3 },
      { x: 27, y: 96, rx: 29, ry: 15, alto: 26, semilla: 11 },
      { x: 203, y: 75, rx: 25, ry: 8, alto: 17, semilla: 23 },
    ],
    // Río: nace al pie del monte del norte y sale por el borde noroeste.
    rio: [[81, 9.5], [72, 6.5], [60, 4.2], [46, 4.8], [33, 3.4], [21, 0]],
    // Carriles del campo de batalla: dos entradas que convergen frente a la muralla y un flanco al sur.
    carriles: [
      [[200, 27], [176, 33], [152, 40], [134, 47], [121, 56]],
      [[198, 90], [176, 82], [152, 73], [134, 66], [121, 60]],
      [[121, 60], [116, 72], [113, 84], [119, 97]],
    ],
    // Dianas de la salva de prueba, sobre los carriles.
    dianas: [{ x: 127.5, y: 52.5 }, { x: 126.5, y: 64.5 }, { x: 134, y: 47.2 }, { x: 134.5, y: 66 }],
  },
  prensa: { id: 'PRS-01', clase: 'prensa', cx: 98, cy: 57 },
  bodega: { id: 'DEP-01', clase: 'arsenal', cx: 102.4, cy: 57 },
  receta: { base: 'nose', sale: 'missile' },
  metas: [{ k: 'cv2.h0.meta', tipo: 'en', lugar: 'DEP-01', pieza: 'missile', n: 4 }],
};
