export default {
  clave: "nivel-1",
  revision: 1,
  hitos: ["h0", "b1", "b2", "b3", "b4", "b5"],
  // Batalla: casillas locales de War con origen en metros del mapa papercraft (ticket 09).
  // Los bastiones son los nudos de Traba donde puede ir una torreta, en casillas locales.
  marco: { origen: [204, 72], tam: [32, 18], puertas: [7], bastiones: [[6, 5], [6, 9], [6, 13]] },
  // Fábrica: coordenadas de Campaign trasladadas a metros (`antiguo.origen` de mapa-ampliado.json).
  fabrica: { origen: [103, 22] },
};

export { default as h0 } from "./h0.js";
export { default as b1 } from "./b1.js";
export { default as b2 } from "./b2.js";
export { default as b3 } from "./b3.js";
export { default as b4 } from "./b4.js";
export { default as b5 } from "./b5.js";
