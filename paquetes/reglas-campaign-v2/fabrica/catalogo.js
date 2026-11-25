/* Campaign-V2 · catálogo de la primera fábrica (misión 1, docs/campaign-v2/MISION-1.md).
 * Solo datos: el motor compartido (paquetes/fabrica) los recibe y no conoce ninguna campaña.
 * Cadena: dos células rápidas con brazo (prensa y moldeadora), una mezcladora lenta que absorbe de sus
 * tarimas y una ensambladora que solo arranca si la energía de la base le alcanza. */
export const VERSION = 2;
export const TARIMA_CAP = 12;
// Los brazos son obreros anclados: el nivel les da `alcance`. El montacargas mueve tarimas enteras.
export const ROBOT = { obrero: { vel: 4, op: 0.5 }, montacargas: { vel: 3, op: 1.2, cargaMax: 2 } };
export const PIEZAS = {
  steel: { nombre: "acero", clase: "M", crudo: true },
  polymer: { nombre: "polímero", clase: "M", crudo: true },
  nose: { nombre: "ojiva", clase: "M" },
  base: { nombre: "base con aletas", clase: "L" },
  charge: { nombre: "carga", clase: "S" },
  missile: { nombre: "misil", clase: "L" },
};
export const RECETAS = {
  nose: { entra: { steel: 1 }, sale: "nose", t: 2 },
  base: { entra: { polymer: 1 }, sale: "base", t: 2.5 },
  // La máquina lenta necesita dos piezas distintas a la vez.
  charge: { entra: { steel: 1, polymer: 1 }, sale: "charge", t: 7 },
  missile: { entra: { nose: 1, base: 1, charge: 1 }, sale: "missile", t: 4 },
};
// `peso` por encima de la carga del montacargas: las máquinas se mueven con el colocador, no con la carretilla.
export const MAQUINAS = {
  prensa: { nombre: "Prensa", recetas: ["nose"], entrada: 2, salida: 2, kw: 2, peso: 3 },
  moldeadora: { nombre: "Moldeadora", recetas: ["base"], entrada: 2, salida: 2, kw: 2, peso: 3 },
  mezcladora: { nombre: "Mezcladora", recetas: ["charge"], entrada: 4, salida: 3, kw: 3, peso: 3, zona: 2, salidaTarima: true },
  ensambladora: { nombre: "Ensambladora", recetas: ["missile"], entrada: 6, salida: 2, kw: 6, peso: 5, cambio: 6,
    zona: 3, umbral: true, entregaA: "DEP-01" },
};
export const BANDA = { vel: 1.2, paso: 1, kw: 1 };
export const COSTE = { steel: 40, polymer: 60 };
export const PEDIDO = { n: TARIMA_CAP, espera: 8, programada: 3, cola: 2 };
export const ARSENAL = { cap: 60, pago: 35, suministro: 1.5 };
export const TORRETA = { cap: 4, cadencia: 0.7, vel: 14, alto: 1.7 };
export const LUCES = ["green", "amber", "red", "off"];
// Sin control maestro en esta misión: cada unidad manda solo en su programa.
export const HITO_MAESTRO = 99;
// Radio de cada clase (m): el colocador no deja solapar dos unidades.
export const RADIO = { obrero: 0.8, montacargas: 1.3, prensa: 1.5, moldeadora: 1.5, mezcladora: 1.7, ensambladora: 2.2,
  lugar: 1, bahia: 1.9, pila: 1, arsenal: 1.9 };
