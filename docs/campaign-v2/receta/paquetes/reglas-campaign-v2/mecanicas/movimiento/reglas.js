// Capacidad compartida: moverse por el campo activo (el marco de batalla).
// La declaran en su ficha VEH, WHL y el minador: `capacidades: ["movimiento"]`.
// Pura: no importa nada; corre en el mundo y su validación también dentro del programa.

/** Verbo `moveTo(lugar)`: modo instantáneo. Cruza la muralla solo por `campo.puertas`. */
export function moveTo(unidad, lugar, campo) { /* fija destino y ruta (ruta(campo, unidad, lugar)) */ }

/** Verbo `stop()`: modo instantáneo. Cancela la ruta; `arrive()` resuelve "detenida". */
export function stop(unidad) {}

/** Espera `await arrive()`: "ok" | "redirigida" | "detenida". Patrón goTo de Campaign. */
export function arrive(unidad) {}

/** Paso: avanza a `unidad.def.vel` m/s por la ruta. Emite `{ evento: "arrive", unidad, datos }`. */
export function paso(campo, dt) {}

/** Ruta por puertas (datos del marco del nivel). */
function ruta(campo, unidad, lugar) {}
