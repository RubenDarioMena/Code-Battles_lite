export default {
  clave: "nivel-1",
  // 2: la fábrica programable (misión 1). Los checkpoints de la prensa automática ya no valen.
  // 3: el taller de carcasas de P7 (EMB-01, SAW-01, LSR-01, FND-01, BOT-01, PAL-6…8) y el hito H6. Un guardado de la
  //    revisión 2 se restauraba sin esas unidades y H6 no se podía cumplir. Toda subida purga los checkpoints viejos.
  //    pruebas/campaign-v2-revision.mjs guarda la huella de la planta y los hitos: si cambian, toca subir este número.
  revision: 3,
  // Cada hito de fábrica (hN) va antes de su Batalla (bN): la bodega que deja es la que llega a la muralla.
  // Tras H5, tres Batallas propias estrenan las unidades móviles: el vehículo (B6), la rueda (B7) y el minador (B8).
  // H6 cierra con el taller de carcasas: la producción circular del consolidado del 23-nov (P7).
  hitos: ["h0", "b1", "h1", "b2", "h2", "b3", "h3", "b4", "h4", "b5", "h5", "b6", "b7", "b8", "h6"],
  // Batalla: casillas locales de War con origen en metros del mapa papercraft (ticket 09).
  // Los bastiones son los nudos de Traba donde puede ir una torreta, en casillas locales.
  marco: { origen: [204, 72], tam: [32, 18], puertas: [7], bastiones: [[6, 5], [6, 9], [6, 13]] },
  // Fábrica: coordenadas de Campaign trasladadas a metros (`antiguo.origen` de mapa-ampliado.json).
  fabrica: { origen: [103, 22] },
};

export { default as fabrica } from "./fabrica.js";
export { default as h0 } from "./h0.js";
export { default as b1 } from "./b1.js";
export { default as h1 } from "./h1.js";
export { default as b2 } from "./b2.js";
export { default as h2 } from "./h2.js";
export { default as b3 } from "./b3.js";
export { default as h3 } from "./h3.js";
export { default as b4 } from "./b4.js";
export { default as h4 } from "./h4.js";
export { default as b5 } from "./b5.js";
export { default as h5 } from "./h5.js";
export { default as b6 } from "./b6.js";
export { default as b7 } from "./b7.js";
export { default as b8 } from "./b8.js";
export { default as h6 } from "./h6.js";
