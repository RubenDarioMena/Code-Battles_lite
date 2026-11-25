import { crearMotor, r2 } from '../fabrica/index.js';

/* Campaign · reglas del nivel: una fábrica continua que avanza por hitos.
 * Sin DOM ni reloj real: paso fijo y estado en datos planos (se guarda tal cual en los checkpoints).
 * Lo cargan el juego y las pruebas de node (pruebas/campaign-reglas.cjs).
 *
 * Tres clases de órdenes, como en el resto del juego:
 *   encargos (tardan y se esperan): pickUp, deliver, goTo · modos (al instante): start, stop,
 *   setRecipe, light, request · lecturas (no avanzan el reloj): count y las propiedades. */
export const VERSION = 1;
export const TARIMA_CAP = 12;
export const ROBOT = { obrero: { vel: 4, op: 0.5 }, montacargas: { vel: 3, op: 1.2, cargaMax: 2 } };
// Tamaño de cada pieza: las ranuras de la ensambladora van por clase (S, M, L).
export const PIEZAS = {
  steel: { nombre: "acero", clase: "M", crudo: true },
  polymer: { nombre: "polímero", clase: "M", crudo: true },
  nose: { nombre: "ojiva", clase: "M" },
  base: { nombre: "base con aletas", clase: "L" },
  charge: { nombre: "carga química", clase: "S" },
  motor: { nombre: "motor", clase: "L" },
  missile: { nombre: "misil", clase: "L" },
};
export const RECETAS = {
  nose: { entra: { steel: 1 }, sale: "nose", t: 2 },
  base: { entra: { polymer: 1 }, sale: "base", t: 6 },
  charge: { entra: { polymer: 1 }, sale: "charge", t: 4.5 },
  motor: { entra: { base: 1, charge: 1 }, sale: "motor", t: 4 },
  missile: { entra: { nose: 1, motor: 1 }, sale: "missile", t: 5 },
};
// Máquinas especializadas: entrada por cantidad. Ensambladora: ranuras por clase de tamaño.
export const MAQUINAS = {
  prensa: { nombre: "Prensa", recetas: ["nose"], entrada: 4, salida: 3, kw: 2, peso: 1.6 },
  moldeadora: { nombre: "Moldeadora", recetas: ["base"], entrada: 3, salida: 3, kw: 3, peso: 1.8 },
  mezcladora: { nombre: "Mezcladora", recetas: ["charge"], entrada: 3, salida: 3, kw: 3, peso: 1.2 },
  ensambladora: { nombre: "Ensambladora", recetas: ["motor", "missile"], ranuras: { S: 4, M: 2, L: 2 }, salida: 2, kw: 5, peso: 4.5, cambio: 6 },
};
export const BANDA = { vel: 1.2, paso: 1, kw: 1 };
export const COSTE = { steel: 40, polymer: 60 };
export const PEDIDO = { n: TARIMA_CAP, espera: 8, programada: 3, cola: 2 };
export const ARSENAL = { cap: 40, pago: 35, suministro: 1.5 };
export const TORRETA = { cap: 4, cadencia: 0.7, vel: 14, alto: 1.7 };
export const LUCES = ["green", "amber", "red", "off"];
export const HITO_MAESTRO = 4;
export { r2 };

// El motor es compartido (paquetes/fabrica); este archivo conserva el catálogo y las exportaciones de siempre.
const motor = crearMotor({ VERSION, PIEZAS, RECETAS, MAQUINAS, ROBOT, BANDA, COSTE, PEDIDO, ARSENAL, TORRETA, LUCES, TARIMA_CAP, HITO_MAESTRO });
export const { esMaquina, esRobot, serializar, crear, indexar, tarimaDe, totalEntrada, capSalida, estadoMaquina,
  cuantos, enLotes, metas, instantanea } = motor;
export { motor };
