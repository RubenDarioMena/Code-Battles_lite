/* Campaign · nivel 1 «Primera fábrica». Solo datos: mapa, instalación e hitos H0–H5.
 * Las medidas son metros (1 casilla = 1 m). El mapa sale del boceto del autor a 10 px por metro:
 * fábrica al oeste, muralla en el centro y campo de batalla al este. */
(() => {
  "use strict";

  // ---------- Mapa ----------
  const MAPA = {
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
  };

  // ---------- Instalación ----------
  // Los puntos de trabajo (ax, ay) quedan dentro del pasillo: ahí se detiene el robot para operar.
  const NORTE = 49.3, SUR = 53.7;
  const pad = (id, x) => ({ id, clase: "pad", cx: x, cy: 46.6, ax: x, ay: NORTE });
  const sup = (id, x) => ({ id, clase: "lugar", tipo: "sup", cx: x, cy: 47.6, ax: x, ay: NORTE });
  const lot = (id, x, tarimaInicial = true) => ({ id, clase: "lugar", tipo: "lot", cx: x, cy: 55.6, ax: x, ay: SUR, tarimaInicial });
  const UNIDADES = [
    // El montacargas va primero: su programa es el que se abre al llegar (la acción guiada de H0).
    { id: "FRK-01", clase: "montacargas", cx: 76, cy: 53, desde: 0 },
    { id: "BOT-01", clase: "obrero", cx: 80, cy: 51.5, desde: 0 },
    { id: "BOT-02", clase: "obrero", cx: 76, cy: 51.5, desde: 5 },
    { id: "PRS-01", clase: "prensa", pad: "PAD-2", desde: 1 },
    { id: "MLD-01", clase: "moldeadora", pad: "PAD-3", desde: 2 },
    { id: "MIX-01", clase: "mezcladora", pad: "PAD-1", desde: 2 },
    { id: "ASM-01", clase: "ensambladora", cx: 93.5, cy: 57, ax: 93.5, ay: SUR, desde: 4 },
    { id: "BLT-01", clase: "banda", x0: 95.3, y0: 57, x1: 101.2, y1: 57, ax: 97, ay: SUR, desde: 5 },
    { id: "CTL-01", clase: "control", cx: 100.4, cy: 45.6, desde: 4 },
    { id: "BAY-1", clase: "bahia", cx: 71.2, cy: 51.5, ax: 73.6, ay: 51.5 },
    sup("SUP-1", 85.6), sup("SUP-2", 93),
    // LOT-5 empieza sin tarima: es el hueco libre para aparcar una.
    lot("LOT-1", 77), lot("LOT-2", 80), lot("LOT-3", 83), lot("LOT-4", 86), lot("LOT-5", 89, false),
    pad("PAD-1", 76), pad("PAD-2", 82), pad("PAD-3", 89.4), pad("PAD-4", 96.6),
    { id: "STK-1", clase: "pila", cx: 73.6, cy: 56, ax: 73.6, ay: SUR },
    { id: "DEP-01", clase: "arsenal", cx: 102.4, cy: 57, ax: 101.6, ay: SUR },
    { id: "LAU-01", clase: "torreta", cx: 104.5, cy: 47 },
    { id: "LAU-02", clase: "torreta", cx: 104.5, cy: 59.5 },
  ];

  // ---------- Hitos ----------
  // Los textos (objetivo, lección y pistas) viven en shared/i18n/campaign.js. «metas» se evalúan sobre el mundo; «alEmpezar» enciende máquinas y trae entregas programadas.
  const HITOS = [
    {
      clave: "H0", titulo: "Llegada",
      pistas: 2,
      alEmpezar: { entregas: [{ lugar: "BAY-1", pieza: "steel", n: 12 }] },
      metas: [{ k: "acero", tipo: "en", lugar: "SUP-1", pieza: "steel", n: 12 }],
    },
    {
      clave: "H1", titulo: "Máquina rápida",
      pistas: 3,
      metas: [{ k: "ojivas", tipo: "lotes", pieza: "nose", n: 6 }],
    },
    {
      clave: "H2", titulo: "Dos estaciones lentas",
      pistas: 3,
      alEmpezar: { entregas: [{ lugar: "BAY-1", pieza: "polymer", n: 12 }] },
      metas: [{ k: "bases", tipo: "lotes", pieza: "base", n: 4 }, { k: "cargas", tipo: "lotes", pieza: "charge", n: 4 }],
    },
    {
      clave: "H3", titulo: "Montacargas y abastecimiento",
      pistas: 3,
      metas: [{ k: "ojivas", tipo: "lotes", pieza: "nose", n: 8 }, { k: "bases", tipo: "lotes", pieza: "base", n: 8 }, { k: "cargas", tipo: "lotes", pieza: "charge", n: 8 }],
    },
    {
      clave: "H4", titulo: "Producción por lotes",
      pistas: 3,
      metas: [{ k: "misiles", tipo: "lotes", pieza: "missile", n: 6 }],
    },
    {
      clave: "H5", titulo: "Primer transportador",
      pistas: 3,
      metas: [{ k: "banda", tipo: "banda", n: 12 }],
    },
  ];

  // ---------- Programas de partida ----------
  // Los de «vivos» llegan sin comentar (acción guiada o cableado por defecto); el resto, comentados.
  const luz = id => [`// La luz de ${id} sigue a su sensor de salida.`, "while (true) {", "  light(outputFull ? \"red\" : \"green\");", "  await wait(0.5);", "}"];
  const INICIAL = {
    "FRK-01": ["// FRK-01 mueve tarimas completas.", "await pickUp(BAY_1);", "await deliver(SUP_1);"],
    "BOT-01": ["await pickUp(SUP_1, \"steel\");", "await deliver(PRS_01);"],
    "BOT-02": ["await pickUp(LOT_4, \"missile\");", "await deliver(BLT_01);"],
    "PRS-01": luz("PRS-01"), "MLD-01": luz("MLD-01"), "MIX-01": luz("MIX-01"),
    "ASM-01": ["setRecipe(\"motor\");", "while (true) {", "  light(outputFull ? \"red\" : \"green\");", "  await wait(0.5);", "}"],
    "BLT-01": ["start();"],
    "CTL-01": ["ASM_01.setRecipe(\"motor\");", "await BOT_01.pickUp(LOT_2, \"base\");", "await BOT_01.deliver(ASM_01);"],
  };
  const VIVOS = ["FRK-01", "PRS-01", "MLD-01", "MIX-01"];

  const NIVEL = {
    serie: "campaign", clave: "campaign-1", revision: 1, titulo: "Primera fábrica",
    mapa: MAPA, unidades: UNIDADES, hitos: HITOS, inicial: INICIAL, vivos: VIVOS,
    presupuesto: 300, premioHito: 50, energia: 9,
    // Campos que la aplicación común espera de cualquier reto.
    robots: UNIDADES.filter(u => Object.hasOwn(INICIAL, u.id)).map(u => ({ id: u.id })),
    lanzadores: [], sensores: [], oleadas: [], metas: {}, pista: "", objetivo: "", leccion: "",
  };
  window.CAMPAIGN_NIVEL = { RETOS: [NIVEL], NIVEL, MAPA };
})();
