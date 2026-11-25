// La planta de la misión 1: mapa, instalación y programas de partida. Los hitos H0–H5 viven en h0.js…h5.js.
// Coordenadas locales de la fábrica (1 casilla = 1 m); `nivel.fabrica.origen` las lleva a metros del mapa.
const MAPA = {
  cols: 200, rows: 104,
  // Muralla: baja recta desde el monte del norte y gira al suroeste hasta el monte del sur.
  muralla: [[104.5, 26.5], [104.5, 62], [104, 68], [102.5, 74], [99.5, 80], [94.5, 85], [87, 88.6], [78, 90.6], [66, 91.8], [51, 92.8]],
  // Losa de la fábrica, pegada a la muralla: el colocador no saca nada de aquí.
  losa: { x0: 70, y0: 42, x1: 103, y1: 62 },
  // El montacargas trabaja desde este pasillo: los puntos de trabajo iniciales quedan dentro.
  pasillo: { x0: 72.5, y0: 49, x1: 102.6, y1: 54 },
  camino: [[0, 50], [18, 52.5], [36, 53.5], [54, 51.5], [70, 51.5]],
  montes: [
    { x: 116, y: 11, rx: 34, ry: 16, alto: 34, semilla: 3 },
    { x: 27, y: 96, rx: 29, ry: 15, alto: 26, semilla: 11 },
    { x: 203, y: 75, rx: 25, ry: 8, alto: 17, semilla: 23 },
  ],
  rio: [[81, 9.5], [72, 6.5], [60, 4.2], [46, 4.8], [33, 3.4], [21, 0]],
  carriles: [
    [[200, 27], [176, 33], [152, 40], [134, 47], [121, 56]],
    [[198, 90], [176, 82], [152, 73], [134, 66], [121, 60]],
    [[121, 60], [116, 72], [113, 84], [119, 97]],
  ],
  dianas: [{ x: 127.5, y: 52.5 }, { x: 126.5, y: 64.5 }, { x: 134, y: 47.2 }, { x: 134.5, y: 66 }],
};

const NORTE = 49.3, SUR = 53.7;
// Tarima libre: el jugador la coloca donde quiera dentro de la losa. `true` la deja con una tarima vacía.
const tarima = (id, x, y, ay, tarimaInicial = false) => ({ id, clase: "lugar", tipo: "lot", cx: x, cy: y, ax: x, ay, tarimaInicial });
const UNIDADES = [
  // El montacargas va primero: su programa es el que se abre al llegar (la acción guiada de H0).
  { id: "FRK-01", clase: "montacargas", cx: 76, cy: 52, desde: 0 },
  // Célula del acero: ARM-01 alcanza PAL-1, la prensa y PAL-2 sin moverse.
  { id: "ARM-01", clase: "obrero", cx: 80, cy: 48.6, alcance: 2.8, desde: 1 },
  { id: "PRS-01", clase: "prensa", cx: 80, cy: 46.2, desde: 1 },
  // Célula del polímero: PAL-3 empieza fuera del alcance de ARM-02 (H2 enseña el colocador).
  { id: "ARM-02", clase: "obrero", cx: 89, cy: 48.6, alcance: 2.8, desde: 2 },
  { id: "MLD-01", clase: "moldeadora", cx: 89, cy: 46.2, desde: 2 },
  // Máquinas con zona de tarimas: el montacargas les deja tarimas enteras.
  { id: "MIX-01", clase: "mezcladora", cx: 82, cy: 57, ax: 82, ay: SUR, desde: 3 },
  { id: "ASM-01", clase: "ensambladora", cx: 95, cy: 57.2, ax: 95, ay: SUR, desde: 4 },
  { id: "BAY-1", clase: "bahia", cx: 71.2, cy: 51.5, ax: 73.6, ay: 51.5 },
  { id: "STK-1", clase: "pila", cx: 73.6, cy: 56, ax: 73.6, ay: SUR },
  tarima("PAL-1", 77.8, 47.6, NORTE),
  tarima("PAL-2", 82.2, 47.6, NORTE, true),
  tarima("PAL-3", 85.2, 47.4, NORTE),
  tarima("PAL-4", 91.2, 47.6, NORTE, true),
  tarima("PAL-5", 88, 56.4, SUR),
  { id: "DEP-01", clase: "arsenal", cx: 101.6, cy: 57, ax: 101.6, ay: SUR },
];

// La luz de cada máquina sigue a su sensor de salida hasta que el jugador la reprograme.
const luz = id => [`// La luz de ${id} sigue a su sensor de salida.`, "while (true) {", "  light(outputFull ? \"red\" : \"green\");", "  await wait(0.5);", "}"];
const INICIAL = {
  "FRK-01": ["// FRK-01 mueve tarimas completas.", "await pickUp(BAY_1);", "await deliver(PAL_1);"],
  "ARM-01": [
    "// ARM-01 está anclado: solo alcanza lo que tiene cerca.",
    "// Un ciclo: acero a la prensa y la ojiva a su tarima.",
    "await pickUp(PAL_1, \"steel\");",
    "await deliver(PRS_01);",
    "await pickUp(PRS_01, \"nose\");",
    "await deliver(PAL_2);",
  ],
  "ARM-02": [
    "// ARM-02 trabaja como ARM-01, con la moldeadora.",
    "await pickUp(PAL_3, \"polymer\");",
    "await deliver(MLD_01);",
    "await pickUp(MLD_01, \"base\");",
    "await deliver(PAL_4);",
  ],
  "PRS-01": luz("PRS-01"), "MLD-01": luz("MLD-01"), "MIX-01": luz("MIX-01"), "ASM-01": luz("ASM-01"),
};

export default {
  mapa: MAPA, unidades: UNIDADES, inicial: INICIAL,
  // Todos llegan sin comentar: el jugador ve y cambia lo que ya corre.
  vivos: Object.keys(INICIAL),
  // Energía de la base en kW, presupuesto inicial, premio por hito y misiles en la bodega al llegar.
  energia: 10, presupuesto: 300, premioHito: 50, bodegaInicial: 48,
};
